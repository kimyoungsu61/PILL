package com.pill.scan;

import com.pill.gemini.GeminiClient;
import com.pill.model.User;
import com.pill.repository.DoseScheduleRepository;
import com.pill.repository.SupplementScanRepository;
import com.pill.repository.UserRepository;
import com.pill.repository.UserSupplementRepository;
import com.pill.scan.ImageUploadValidator.ValidatedImage;
import com.pill.scan.dto.ConfirmScanRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@DataJpaTest
@Import({ScanService.class, ScanServiceTest.Config.class})
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class ScanServiceTest {
    @Autowired ScanService scans;
    @Autowired UserRepository users;
    @Autowired SupplementScanRepository scanRepository;
    @Autowired UserSupplementRepository supplements;
    @Autowired DoseScheduleRepository doseSchedules;
    @Autowired GeminiClient gemini;

    @Test
    void analyzeStoresRawAndNormalizedGeminiResultForCurrentUser() {
        var user = users.save(new User("scan@example.com", "hash"));
        when(gemini.analyzeLabel(any(byte[].class), eq("image/png"), any(byte[].class), eq("image/jpeg"))).thenReturn("""
            {
              "brandName": "Healthy Labs",
              "productName": "Morning Vitamin",
              "suggestedUseOriginal": "Take one tablet daily.",
              "suggestedUseKo": "하루 1정 섭취",
              "warningsOriginal": "Consult a doctor if pregnant.",
              "warningsKo": "임신 중이면 전문가와 상담하세요.",
              "originalLabelText": "Supplement Facts",
              "recommendedDoseTime": "MORNING",
              "ingredients": [
                { "name": "Vitamin C", "amount": "500", "unit": "mg", "originalText": "Vitamin C 500 mg", "confidence": 0.91 }
              ]
            }
            """);

        var response = scans.analyze(
            user.getId(),
            image("front.png", "image/png", "front"),
            image("back.jpg", "image/jpeg", "back")
        );

        assertThat(response.scanId()).isNotNull();
        assertThat(response.status()).isEqualTo("COMPLETED");
        assertThat(response.productName()).isEqualTo("Morning Vitamin");
        assertThat(response.ingredients()).singleElement()
            .satisfies(ingredient -> assertThat(ingredient.needsReview()).isFalse());

        var savedScan = scanRepository.findById(response.scanId()).orElseThrow();
        assertThat(savedScan.getUser().getId()).isEqualTo(user.getId());
        assertThat(savedScan.getRawAiResponseJson()).contains("Morning Vitamin");
        assertThat(savedScan.getNormalizedAiResultJson()).contains("Morning Vitamin");
    }

    @Test
    void analyzeAcceptsFrontImageWithoutBackImage() {
        var user = users.save(new User("front-only-scan@example.com", "hash"));
        when(gemini.analyzeLabel(any(byte[].class), eq("image/png"), isNull(), isNull())).thenReturn("""
            {
              "brandName": "Daily Lab",
              "productName": "Front Only Vitamin",
              "suggestedUseOriginal": "",
              "suggestedUseKo": "",
              "warningsOriginal": "",
              "warningsKo": "",
              "originalLabelText": "Front label",
              "recommendedDoseTime": "09:00",
              "ingredients": []
            }
            """);

        var response = scans.analyze(
            user.getId(),
            image("front.png", "image/png", "front"),
            null
        );

        assertThat(response.status()).isEqualTo("COMPLETED");
        assertThat(response.productName()).isEqualTo("Front Only Vitamin");

        var savedScan = scanRepository.findById(response.scanId()).orElseThrow();
        assertThat(savedScan.getImageMetadata()).contains("\"backImage\":null");
    }

    @Test
    void analyzeStoresFencedGeminiTextInsideValidJsonWrapper() {
        var user = users.save(new User("fenced-scan@example.com", "hash"));
        when(gemini.analyzeLabel(any(byte[].class), eq("image/png"), any(byte[].class), eq("image/jpeg"))).thenReturn("""
            ```json
            {
              "productName": "Fenced Vitamin",
              "ingredients": []
            }
            ```
            """);

        var response = scans.analyze(
            user.getId(),
            image("front.png", "image/png", "front"),
            image("back.jpg", "image/jpeg", "back")
        );

        var savedScan = scanRepository.findById(response.scanId()).orElseThrow();
        assertThat(response.productName()).isEqualTo("Fenced Vitamin");
        assertThat(savedScan.getRawAiResponseJson()).contains("\"text\"");
        assertThat(savedScan.getRawAiResponseJson()).contains("```json");
    }

    @Test
    void getRejectsOtherUsersScan() {
        var owner = users.save(new User("scan-owner@example.com", "hash"));
        var viewer = users.save(new User("scan-viewer@example.com", "hash"));
        when(gemini.analyzeLabel(any(byte[].class), any(), any(byte[].class), any())).thenReturn("{\"productName\":\"Hidden\",\"ingredients\":[]}");
        var response = scans.analyze(
            owner.getId(),
            image("front.png", "image/png", "front"),
            image("back.jpg", "image/jpeg", "back")
        );

        assertThatThrownBy(() -> scans.get(viewer.getId(), response.scanId()))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("scan not found");
    }

    @Test
    void confirmCreatesUserSupplementWithIngredients() {
        var user = users.save(new User("confirm@example.com", "hash"));
        when(gemini.analyzeLabel(any(byte[].class), any(), any(byte[].class), any())).thenReturn("{\"productName\":\"Draft\",\"ingredients\":[]}");
        var response = scans.analyze(
            user.getId(),
            image("front.png", "image/png", "front"),
            image("back.jpg", "image/jpeg", "back")
        );

        var supplementId = scans.confirm(user.getId(), response.scanId(), new ConfirmScanRequest(
            "Healthy Labs",
            "Morning Vitamin",
            "하루 1정",
            "Take one tablet daily.",
            "비타민 요약",
            "Supplement Facts",
            "주의 없음",
            "09:00",
            List.of(new ConfirmScanRequest.Ingredient("Vitamin C", "500", "mg", "Vitamin C 500 mg", 0.91, false)),
            "file:///phone/label.jpg"
        ));

        var supplement = supplements.findByIdAndUserId(supplementId, user.getId()).orElseThrow();
        assertThat(supplement.getProductName()).isEqualTo("Morning Vitamin");
        assertThat(supplement.getIngredients()).singleElement()
            .satisfies(ingredient -> assertThat(ingredient.getName()).isEqualTo("Vitamin C"));
    }

    @Test
    void confirmCreatesKoreanDisplayNameAndStoresImageUri() {
        var user = users.save(new User("confirm-display@example.com", "hash"));
        when(gemini.analyzeLabel(any(byte[].class), any(), any(byte[].class), any())).thenReturn("{\"productName\":\"Draft\",\"ingredients\":[]}");
        var response = scans.analyze(
            user.getId(),
            image("front.png", "image/png", "front"),
            image("back.jpg", "image/jpeg", "back")
        );

        var supplementId = scans.confirm(user.getId(), response.scanId(), new ConfirmScanRequest(
            "nanowell",
            "HOVENIA-Rx MILK THISTLE Silymarin 80% Extract",
            "하루 1정",
            "Take one tablet daily.",
            "실리마린 요약",
            "Supplement Facts",
            "주의 없음",
            "09:00",
            List.of(new ConfirmScanRequest.Ingredient("Milk Thistle", "500", "mg", "Silymarin 80%", 0.91, false)),
            "file:///phone/milk-thistle.jpg"
        ));

        var supplement = supplements.findByIdAndUserId(supplementId, user.getId()).orElseThrow();
        assertThat(supplement.getDisplayNameKo()).isEqualTo("밀크씨슬");
        assertThat(supplement.getImageUri()).isEqualTo("file:///phone/milk-thistle.jpg");
    }

    @Test
    void confirmCreatesMultipleDoseSchedulesWhenSuggestedUseIsTwiceDaily() {
        var user = users.save(new User("confirm-twice@example.com", "hash"));
        when(gemini.analyzeLabel(any(byte[].class), any(), any(byte[].class), any())).thenReturn("{\"productName\":\"Draft\",\"ingredients\":[]}");
        var response = scans.analyze(
            user.getId(),
            image("front.png", "image/png", "front"),
            image("back.jpg", "image/jpeg", "back")
        );

        var supplementId = scans.confirm(user.getId(), response.scanId(), new ConfirmScanRequest(
            "nanowell",
            "HOVENIA-Rx MILK THISTLE Silymarin 80% Extract",
            "하루 2번, 1회 2정 섭취",
            "Take 2 tablets twice daily.",
            "실리마린 요약",
            "Suggested Use: Take 2 tablets twice daily.",
            "주의 없음",
            "09:00",
            List.of(new ConfirmScanRequest.Ingredient("Milk Thistle", "500", "mg", "Silymarin 80%", 0.91, false)),
            "file:///phone/milk-thistle.jpg"
        ));

        assertThat(doseSchedules.findAll())
            .filteredOn(schedule -> schedule.getSupplement().getId().equals(supplementId))
            .extracting(schedule -> schedule.getConfirmedTime())
            .containsExactly("09:00", "19:00");
        assertThat(supplements.findByIdAndUserId(supplementId, user.getId()).orElseThrow().getConfirmedDoseTime())
            .isEqualTo("09:00,19:00");
    }

    @Test
    void confirmCreatesMealSpacedDoseSchedulesWhenSuggestedUseIsThreeTimesDaily() {
        var user = users.save(new User("confirm-three-times@example.com", "hash"));
        when(gemini.analyzeLabel(any(byte[].class), any(), any(byte[].class), any())).thenReturn("{\"productName\":\"Draft\",\"ingredients\":[]}");
        var response = scans.analyze(
            user.getId(),
            image("front.png", "image/png", "front"),
            image("back.jpg", "image/jpeg", "back")
        );

        var supplementId = scans.confirm(user.getId(), response.scanId(), new ConfirmScanRequest(
            "brand",
            "Three Times Supplement",
            "",
            "Take 1 capsule three times daily.",
            "summary",
            "Suggested Use: Take 1 capsule three times daily.",
            "",
            "09:00",
            List.of(),
            "file:///phone/three-times.jpg"
        ));

        assertThat(doseSchedules.findAll())
            .filteredOn(schedule -> schedule.getSupplement().getId().equals(supplementId))
            .extracting(schedule -> schedule.getConfirmedTime())
            .containsExactly("09:00", "13:00", "19:00");
        assertThat(supplements.findByIdAndUserId(supplementId, user.getId()).orElseThrow().getConfirmedDoseTime())
            .isEqualTo("09:00,13:00,19:00");
    }

    static class Config {
        @Bean
        GeminiClient geminiClient() {
            return mock(GeminiClient.class);
        }
    }

    private static ValidatedImage image(String filename, String contentType, String content) {
        return new ValidatedImage(content.getBytes(StandardCharsets.UTF_8), contentType, filename);
    }
}
