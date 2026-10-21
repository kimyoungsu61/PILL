package com.pill.gemini;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GeminiRecognitionTest {
    private static final String ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void identifiesNonSupplementInFirstImageCallWithoutDoingSupplementResearch() throws Exception {
        for (var target : List.of(
            new String[] {"ALCOHOL", "참이슬 소주", "소주를 찍으셨네요. 술은 건강에 부담을 줄 수 있어요."},
            new String[] {"BEVERAGE", "콜라", "콜라를 찍으셨네요. 당과 카페인 여부는 라벨을 확인해 주세요."},
            new String[] {"BEVERAGE", "제로 콜라", "제로 콜라를 찍으셨네요. 카페인 여부는 라벨을 확인해 주세요."},
            new String[] {"OTHER", "운동화", "운동화를 찍으셨네요. 세탁 전 소재별 관리 방법을 확인해 주세요."},
            new String[] {"UNKNOWN", "", "uncertain"})) {
            var builder = RestClient.builder();
            var server = MockRestServiceServer.bindTo(builder).build();
            var observed = mapper.createObjectNode().put("brandName", "brand").put("productName", "visible product")
                .put("suggestedUseKo", "invented supplement use").put("recommendedDoseTime", "09:00");
            observed.putArray("ingredients").addObject().put("name", "invented nutrient");
            observed.set("recognition", mapper.valueToTree(Map.of("category", target[0], "displayName", target[1],
                "confidence", 0.99, "messageKo", target[2], "registrationAllowed", true)));
            server.expect(requestTo(ENDPOINT))
                .andExpect(jsonPath("$.generationConfig.responseSchema.properties.recognition.required[0]").value("category"))
                .andExpect(jsonPath("$.generationConfig.responseSchema.properties.recognition.properties.category.enum[1]").value("ALCOHOL"))
                .andRespond(withSuccess(envelope(observed.toString()), MediaType.APPLICATION_JSON));
            var client = new GeminiClient(new GeminiProperties("test", ENDPOINT), builder.build(), mapper);
            var result = mapper.readTree(client.analyzeLabel(new byte[] {1}, "image/jpeg", null, null));
            assertThat(result.at("/recognition/category").asText()).isEqualTo(target[0]);
            assertThat(result.at("/recognition/registrationAllowed").asBoolean()).isFalse();
            assertThat(result.path("ingredients").isEmpty()).isTrue();
            assertThat(result.path("suggestedUseKo").asText()).isEmpty();
            assertThat(result.path("recommendedDoseTime").asText()).isEmpty();
            assertThat(result.has("research")).isFalse();
            assertThat(result.has("productInformation")).isFalse();
            if (!"UNKNOWN".equals(target[0])) assertThat(result.at("/recognition/messageKo").asText()).isEqualTo(target[2]);
            server.verify(); // Any supplemental lookup would be an unexpected second network call.
        }
    }

    @Test
    void missingOrMalformedClassificationDoesNotTriggerLookupFromBrandAndProductAlone() throws Exception {
        for (var recognition : List.of("null", "{\"category\":\"SUPPLEMENT\",\"displayName\":\"Vitamin\",\"confidence\":100}")) {
            var builder = RestClient.builder();
            var server = MockRestServiceServer.bindTo(builder).build();
            var observed = "{\"brandName\":\"brand\",\"productName\":\"Vitamin\",\"recognition\":" + recognition + "}";
            server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(envelope(observed), MediaType.APPLICATION_JSON));
            var client = new GeminiClient(new GeminiProperties("test", ENDPOINT), builder.build(), mapper);
            var result = mapper.readTree(client.analyzeLabel(new byte[] {1}, "image/jpeg", new byte[] {2}, "image/jpeg"));
            assertThat(result.at("/recognition/category").asText()).isEqualTo("UNKNOWN");
            assertThat(result.at("/recognition/registrationAllowed").asBoolean()).isFalse();
            assertThat(result.has("research")).isFalse();
            server.verify();
        }
    }

    private String envelope(String text) throws Exception {
        return mapper.writeValueAsString(Map.of("candidates", List.of(Map.of("content",
            Map.of("parts", List.of(Map.of("text", text)))))));
    }
}
