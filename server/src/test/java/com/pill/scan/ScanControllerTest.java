package com.pill.scan;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pill.auth.AuthSessionService;
import com.pill.gemini.GeminiClient;
import com.pill.model.User;
import com.pill.repository.UserRepository;
import com.pill.repository.UserSupplementRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.web.servlet.MultipartProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:scan-controller-test;MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class ScanControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired MultipartProperties multipartProperties;
    @Autowired AuthSessionService sessions;
    @Autowired UserRepository users;
    @Autowired UserSupplementRepository supplements;
    @MockitoBean GeminiClient gemini;

    @Test
    void allowsPhoneSizedLabelPhotos() {
        assertThat(multipartProperties.getMaxFileSize().toMegabytes()).isGreaterThanOrEqualTo(8);
        assertThat(multipartProperties.getMaxRequestSize().toMegabytes()).isGreaterThanOrEqualTo(16);
    }

    @Test
    void createsGetsAndConfirmsScanUsingBearerToken() throws Exception {
        var user = users.save(new User("scan-api@example.com", "hash"));
        when(gemini.analyzeLabel(any(byte[].class), eq("image/png"), any(byte[].class), eq("image/jpeg"))).thenReturn("""
            {
              "brandName": "Healthy Labs",
              "productName": "Morning Vitamin",
              "suggestedUseKo": "하루 1정",
              "suggestedUseOriginal": "Take one tablet daily.",
              "warningsKo": "",
              "warningsOriginal": "",
              "originalLabelText": "Supplement Facts",
              "recommendedDoseTime": "MORNING",
              "servingBasisKo": "1정당",
              "productInformation": {"otherIngredients":["cellulose"],"guidance":{"overviewKo":"비타민을 이해하기 쉽게 설명해요.","sources":[{"title":"Manufacturer","url":"https://example.org/product"}]}},
              "ingredients": [
                { "name": "Vitamin C", "amount": "500", "unit": "mg", "originalText": "Vitamin C 500 mg", "confidence": 0.91 },
                { "name": "Remove Me", "amount": "10", "unit": "mg", "originalText": "Remove Me 10 mg", "confidence": 0.7 }
              ]
            }
            """);
        var frontImage = new MockMultipartFile("frontImage", "front.png", "image/png", pngBytes());
        var backImage = new MockMultipartFile("backImage", "back.jpg", "image/jpeg", jpegBytes());
        var token = sessions.issue(user).token();

        var createResult = mvc.perform(multipart("/api/scans")
                .file(frontImage)
                .file(backImage)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("COMPLETED"))
            .andExpect(jsonPath("$.productName").value("Morning Vitamin"))
            .andExpect(jsonPath("$.ingredients[0].name").value("Vitamin C"))
            .andReturn();
        var scanId = mapper.readTree(createResult.getResponse().getContentAsString()).path("scanId").asLong();

        mvc.perform(get("/api/scans/" + scanId).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.scanId").value(scanId))
            .andExpect(jsonPath("$.productName").value("Morning Vitamin"))
            .andExpect(jsonPath("$.servingBasisKo").value("1정당"));

        var confirmJson = """
            {
              "brandName": "Healthy Labs",
              "productName": "Morning Vitamin",
              "suggestedUseKo": "하루 1정",
              "suggestedUseOriginal": "Take one tablet daily.",
              "summaryKo": "비타민 요약",
              "originalLabelText": "Supplement Facts",
              "warningSummary": "",
              "confirmedDoseTime": "09:00",
              "servingBasisKo": "2정당",
              "ingredients": [
                { "name": "비타민 C", "amount": "250", "unit": "µg", "originalText": "Vitamin C 500 mg", "confidence": 0.0, "needsReview": false },
                { "name": "아연", "amount": "5", "unit": "mg", "originalText": "", "confidence": 0.0, "needsReview": false }
              ]
            }
            """;
        var confirmResult = mvc.perform(put("/api/scans/" + scanId + "/confirmed")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(confirmJson))
            .andExpect(status().isOk())
            .andReturn();
        var supplementId = Long.parseLong(confirmResult.getResponse().getContentAsString());

        assertThat(supplements.findByIdAndUserId(supplementId, user.getId())).isPresent();
        mvc.perform(get("/api/supplements/" + supplementId).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.servingBasisKo").value("2정당"))
            .andExpect(jsonPath("$.ingredients.length()").value(2))
            .andExpect(jsonPath("$.ingredients[0].name").value("비타민 C"))
            .andExpect(jsonPath("$.ingredients[0].amount").value("250"))
            .andExpect(jsonPath("$.ingredients[0].unit").value("µg"))
            .andExpect(jsonPath("$.ingredients[0].originalText").value("Vitamin C 500 mg"))
            .andExpect(jsonPath("$.ingredients[1].name").value("아연"))
            .andExpect(jsonPath("$.productInformation.guidance.overviewKo").value("비타민을 이해하기 쉽게 설명해요."))
            .andExpect(jsonPath("$.productInformation.otherIngredients[0]").value("cellulose"));
        mvc.perform(get("/api/export").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.supplements[0].servingBasisKo").value("2정당"));
        mvc.perform(get("/api/scans/" + scanId).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.servingBasisKo").value("1정당"))
            .andExpect(jsonPath("$.ingredients[0].amount").value("500"));
    }

    @Test
    void rejectsOverlongServingBasisBeforeSaving() throws Exception {
        var user = users.save(new User("basis-validation@example.com", "hash"));
        var token = sessions.issue(user).token();
        var body = mapper.createObjectNode().put("productName", "Vitamin")
            .put("confirmedDoseTime", "09:00").put("servingBasisKo", "a".repeat(256));
        mvc.perform(put("/api/scans/999999/confirmed")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void createsScanWithFrontImageOnly() throws Exception {
        var user = users.save(new User("front-only-scan-api@example.com", "hash"));
        when(gemini.analyzeLabel(any(byte[].class), eq("image/png"), isNull(), isNull())).thenReturn("""
            {
              "brandName": "Daily Lab",
              "productName": "Front Only Vitamin",
              "suggestedUseKo": "",
              "suggestedUseOriginal": "",
              "warningsKo": "",
              "warningsOriginal": "",
              "originalLabelText": "Front label",
              "recommendedDoseTime": "09:00",
              "ingredients": []
            }
            """);
        var frontImage = new MockMultipartFile("frontImage", "front.png", "image/png", pngBytes());
        var token = sessions.issue(user).token();

        mvc.perform(multipart("/api/scans")
                .file(frontImage)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("COMPLETED"))
            .andExpect(jsonPath("$.productName").value("Front Only Vitamin"));
    }

    @Test
    void emptyUploadReturnsBadRequestBeforeCallingGemini() throws Exception {
        var user = users.save(new User("empty-scan@example.com", "hash"));
        var token = sessions.issue(user).token();
        var frontImage = new MockMultipartFile("frontImage", "front.png", "image/png", pngBytes());
        var emptyBackImage = new MockMultipartFile("backImage", "empty.png", "image/png", new byte[0]);

        mvc.perform(multipart("/api/scans")
                .file(frontImage)
            .file(emptyBackImage)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_IMAGE"))
            .andExpect(jsonPath("$.message").isString());

        verify(gemini, never()).analyzeLabel(any(byte[].class), any(), any(byte[].class), any());
    }

    @Test
    void oversizedImageReturnsPayloadTooLargeBeforeCallingGemini() throws Exception {
        var user = users.save(new User("oversized-scan@example.com", "hash"));
        var token = sessions.issue(user).token();
        var bytes = new byte[8 * 1024 * 1024 + 1];
        bytes[0] = (byte) 0xff;
        bytes[1] = (byte) 0xd8;
        bytes[2] = (byte) 0xff;
        var frontImage = new MockMultipartFile("frontImage", "large.jpg", "image/jpeg", bytes);

        mvc.perform(multipart("/api/scans")
                .file(frontImage)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isPayloadTooLarge())
            .andExpect(jsonPath("$.code").value("UPLOAD_TOO_LARGE"));

        verify(gemini, never()).analyzeLabel(any(byte[].class), any(), any(), any());
    }

    @Test
    void geminiHttpFailureReturnsServiceUnavailableMessage() throws Exception {
        var user = users.save(new User("gemini-failure@example.com", "hash"));
        var token = sessions.issue(user).token();
        var frontImage = new MockMultipartFile("frontImage", "front.png", "image/png", pngBytes());
        var backImage = new MockMultipartFile("backImage", "back.jpg", "image/jpeg", jpegBytes());
        when(gemini.analyzeLabel(any(byte[].class), eq("image/png"), any(byte[].class), eq("image/jpeg"))).thenThrow(
            new RestClientResponseException(
                "Gemini unavailable",
                503,
                "Service Unavailable",
                null,
                "unavailable".getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
            )
        );

        mvc.perform(multipart("/api/scans")
                .file(frontImage)
                .file(backImage)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.code").value("PROVIDER_UNAVAILABLE"))
            .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void invalidGeminiJsonReturnsServiceUnavailableMessage() throws Exception {
        var user = users.save(new User("gemini-invalid-json@example.com", "hash"));
        var token = sessions.issue(user).token();
        var frontImage = new MockMultipartFile("frontImage", "front.png", "image/png", pngBytes());
        var backImage = new MockMultipartFile("backImage", "back.jpg", "image/jpeg", jpegBytes());
        when(gemini.analyzeLabel(any(byte[].class), eq("image/png"), any(byte[].class), eq("image/jpeg")))
            .thenReturn("<!DOCTYPE html><html><title>502: Bad gateway</title></html>");

        mvc.perform(multipart("/api/scans")
                .file(frontImage)
                .file(backImage)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.code").value("PROVIDER_UNAVAILABLE"))
            .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void limitsEachUserToThreeScanRequestsPerMinute() throws Exception {
        var user = users.save(new User("scan-rate-limit@example.com", "hash"));
        var token = sessions.issue(user).token();
        var frontImage = new MockMultipartFile("frontImage", "front.png", "image/png", pngBytes());
        when(gemini.analyzeLabel(any(byte[].class), eq("image/png"), isNull(), isNull())).thenReturn("""
            {
              "brandName": "Daily Lab",
              "productName": "Rate Limited Vitamin",
              "suggestedUseKo": "",
              "suggestedUseOriginal": "",
              "warningsKo": "",
              "warningsOriginal": "",
              "originalLabelText": "Front label",
              "recommendedDoseTime": "09:00",
              "ingredients": []
            }
            """);

        for (var index = 0; index < 3; index++) {
            mvc.perform(multipart("/api/scans")
                    .file(frontImage)
                    .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        }

        mvc.perform(multipart("/api/scans")
                .file(frontImage)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().exists("Retry-After"))
            .andExpect(jsonPath("$.code").value("RATE_LIMITED"));

        verify(gemini, times(3)).analyzeLabel(any(byte[].class), eq("image/png"), isNull(), isNull());
    }

    @Test
    void confirmRejectsMoreThanOneHundredIngredients() throws Exception {
        var token = tokenFor("confirm-ingredient-limit@example.com");
        var body = validConfirmBody();
        var ingredients = body.withArray("ingredients");
        for (var index = 0; index < 101; index++) {
            ingredients.addObject()
                .put("name", "Ingredient " + index)
                .put("confidence", 0.8)
                .put("needsReview", false);
        }

        confirm(token, body)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void confirmRejectsOverlongFieldsAndOutOfRangeConfidence() throws Exception {
        var token = tokenFor("confirm-field-limit@example.com");

        var overlongName = validConfirmBody().put("productName", "a".repeat(256));
        confirm(token, overlongName)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        var overlongLabel = validConfirmBody().put("originalLabelText", "a".repeat(20_001));
        confirm(token, overlongLabel)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        var invalidConfidence = validConfirmBody();
        invalidConfidence.withArray("ingredients").addObject()
            .put("name", "Vitamin C")
            .put("confidence", 1.01)
            .put("needsReview", false);
        confirm(token, invalidConfidence)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        var nullIngredient = validConfirmBody();
        nullIngredient.withArray("ingredients").addNull();
        confirm(token, nullIngredient)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void confirmRejectsMalformedAndMoreThanThreeDoseTimes() throws Exception {
        var token = tokenFor("confirm-time-limit@example.com");

        confirm(token, validConfirmBody().put("confirmedDoseTime", "9:00"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        confirm(token, validConfirmBody().put("confirmedDoseTime", "08:00,12:00,16:00,20:00"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    private org.springframework.test.web.servlet.ResultActions confirm(String token, ObjectNode body) throws Exception {
        return mvc.perform(put("/api/scans/1/confirmed")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsBytes(body)));
    }

    private String tokenFor(String email) {
        return sessions.issue(users.save(new User(email, "hash"))).token();
    }

    private ObjectNode validConfirmBody() {
        var body = mapper.createObjectNode();
        body.put("brandName", "Healthy Labs");
        body.put("productName", "Morning Vitamin");
        body.put("suggestedUseKo", "하루 1정");
        body.put("suggestedUseOriginal", "Take one tablet daily.");
        body.put("summaryKo", "비타민 요약");
        body.put("originalLabelText", "Supplement Facts");
        body.put("warningSummary", "");
        body.put("confirmedDoseTime", "09:00");
        body.putArray("ingredients");
        body.put("imageUri", "file:///phone/label.jpg");
        return body;
    }

    private static byte[] jpegBytes() {
        return new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, 0x00};
    }

    private static byte[] pngBytes() {
        return new byte[] {
            (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00
        };
    }
}
