package com.pill.scan;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ScanRecognitionTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void permissionComesFromStrictCategoryConfidenceAndIdentityNotProviderFlag() throws Exception {
        var supplement = ScanRecognition.from(mapper.readTree("""
            {"category":"SUPPLEMENT","displayName":"마그네슘 영양제","confidence":0.8,"registrationAllowed":false}
            """));
        assertThat(supplement.registrationAllowed()).isTrue();
        for (var category : List.of("ALCOHOL", "BEVERAGE", "FOOD", "MEDICINE", "OTHER", "UNKNOWN")) {
            var json = mapper.createObjectNode().put("category", category).put("displayName", "대상")
                .put("confidence", 1).put("registrationAllowed", true);
            assertThat(ScanRecognition.from(json).registrationAllowed()).isFalse();
        }
    }

    @Test
    void missingMalformedAndUncertainRecognitionCannotEnableRegistration() throws Exception {
        for (var raw : List.of("{}", "null", "[]", "\"SUPPLEMENT\"",
            "{\"category\":\"SUPPLEMENT\",\"displayName\":\"비타민\",\"confidence\":\"0.99\"}",
            "{\"category\":\"SUPPLEMENT\",\"displayName\":\"비타민\",\"confidence\":100}",
            "{\"category\":\"SUPPLEMENT\",\"displayName\":\"비타민\",\"confidence\":-1}",
            "{\"category\":\"SUPPLEMENT\",\"displayName\":\"비타민\",\"confidence\":0.79}",
            "{\"category\":\"SUPPLEMENT\",\"displayName\":\"  \",\"confidence\":1}",
            "{\"category\":\"HEALTHY\",\"displayName\":\"비타민\",\"confidence\":1}")) {
            var result = ScanRecognition.from(mapper.readTree(raw));
            assertThat(result.category()).as(raw).isEqualTo("UNKNOWN");
            assertThat(result.registrationAllowed()).as(raw).isFalse();
            assertThat(result.messageKo()).contains("구분하기 어려워요");
        }
        var notFinite = mapper.createObjectNode().put("category", "SUPPLEMENT")
            .put("displayName", "비타민").put("confidence", Double.NaN);
        assertThat(ScanRecognition.from(notFinite).registrationAllowed()).isFalse();
        notFinite.put("confidence", Double.POSITIVE_INFINITY);
        assertThat(ScanRecognition.from(notFinite).registrationAllowed()).isFalse();
    }

    @Test
    void recognizedSojuAndZeroColaRetainTargetMessageButDiscardSupplementContent() throws Exception {
        for (var target : List.of(
            new String[] {"ALCOHOL", "참이슬 소주", "소주를 찍으셨네요. 술은 건강에 부담을 줄 수 있어요."},
            new String[] {"BEVERAGE", "제로 콜라", "제로 콜라를 찍으셨네요. 카페인 여부는 라벨을 확인해 주세요."})) {
            var root = mapper.createObjectNode().put("productName", "fresh")
                .put("suggestedUseKo", "하루 1회").put("recommendedDoseTime", "09:00")
                .put("warningsKo", "unrelated").put("servingBasisKo", "1정당");
            root.set("recognition", mapper.createObjectNode().put("category", target[0])
                .put("displayName", target[1]).put("messageKo", target[2]).put("confidence", 0.99)
                .put("registrationAllowed", true));
            root.putArray("ingredients").addObject().put("name", "invented nutrient");
            root.putObject("research").putObject("candidate").put("productName", "Vitamin")
                .putObject("recognition").put("category", "SUPPLEMENT").put("confidence", 1);
            root.putObject("productInformation").put("routineTipKo", "invented dose");
            var result = ScanService.normalize(root.toString());
            assertThat(result.recognition().displayName()).isEqualTo(target[1]);
            assertThat(result.recognition().messageKo()).isEqualTo(target[2]);
            assertThat(result.recognition().registrationAllowed()).isFalse();
            assertThat(result.ingredients()).isEmpty();
            assertThat(result.suggestedUseKo()).isEmpty();
            assertThat(result.recommendedDoseTime()).isEmpty();
            assertThat(result.warningsKo()).isEmpty();
            assertThat(result.servingBasisKo()).isEmpty();
            assertThat(result.research()).isNull();
            assertThat(result.productInformation()).isNull();
        }
    }

    @Test
    void legacyAnalysisRemainsReadableButRequiresRecognitionBeforeRegistration() {
        var result = ScanService.normalize("{\"productName\":\"Old Vitamin\",\"ingredients\":[{\"name\":\"C\"}]}");
        assertThat(result.productName()).isEqualTo("Old Vitamin");
        assertThat(result.recognition().category()).isEqualTo("UNKNOWN");
        assertThat(result.recognition().registrationAllowed()).isFalse();
        assertThat(result.ingredients()).isEmpty();
    }
}
