package com.pill.gemini;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GeminiSearchTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private static final String ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    private static final String LABEL = "{\"brandName\":\"Example\",\"productName\":\"Vitamin\",\"ingredients\":[],\"originalLabelText\":\"Example Vitamin 60 capsules\"}";
    private static final String REPORT = """
        {"matchStatus":"MATCHED","matchReasonKo":"같은 규격의 후보","candidate":{
        "brandName":"Example","productName":"Vitamin","servingBasisKo":"1정당",
        "suggestedUseKo":"출처의 섭취 방법","ingredients":[{"name":"C","amount":"100","unit":"mg","confidence":1.0}]}}
        """;

    private String envelope(String text, boolean grounded) throws Exception {
        var candidate = mapper.createObjectNode();
        candidate.set("content", mapper.valueToTree(Map.of("parts", List.of(
            Map.of("thought", true, "text", "private reasoning"), Map.of("text", text)))));
        if (grounded) candidate.set("groundingMetadata", mapper.valueToTree(Map.of(
            "groundingChunks", List.of(Map.of("web", Map.of("uri", "https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/", "title", "Product"))),
            "groundingSupports", List.of(Map.of("groundingChunkIndices", List.of(0))),
            "webSearchQueries", List.of("Example Vitamin label"))));
        return mapper.writeValueAsString(Map.of("candidates", List.of(candidate)));
    }

    @Test void searchIsSeparateAndDoesNotOverwritePhotographedFacts() throws Exception {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(ENDPOINT)).andExpect(jsonPath("$.generationConfig.responseSchema.type").value("OBJECT"))
            .andRespond(withSuccess(envelope(LABEL, false), MediaType.APPLICATION_JSON));
        server.expect(requestTo(ENDPOINT)).andExpect(jsonPath("$.tools[0].google_search").exists())
            .andRespond(withSuccess(envelope(REPORT, true), MediaType.APPLICATION_JSON));
        var result = mapper.readTree(new GeminiClient(new GeminiProperties("test", ENDPOINT), builder.build(), mapper, url -> "")
            .analyzeLabel(new byte[]{1}, "image/jpeg", null, null));
        assertThat(result.path("ingredients").size()).isZero();
        assertThat(result.at("/research/status").asText()).isEqualTo("CANDIDATE");
        assertThat(result.at("/research/verified").asBoolean()).isFalse();
        assertThat(result.at("/research/candidate/ingredients/0/needsReview").asBoolean()).isTrue();
        assertThat(result.at("/research/sources/0/url").asText()).isEqualTo("https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/");
        server.verify();
    }

    @Test void ungroundedOutputCannotBecomeAProductCandidate() throws Exception {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(envelope(LABEL, false), MediaType.APPLICATION_JSON));
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(envelope(REPORT, false), MediaType.APPLICATION_JSON));
        var result = mapper.readTree(new GeminiClient(new GeminiProperties("test", ENDPOINT), builder.build(), mapper, url -> "")
            .analyzeLabel(new byte[]{1}, "image/jpeg", null, null));
        assertThat(result.at("/research/status").asText()).isEqualTo("NO_SOURCES");
        assertThat(result.at("/research/candidate").isMissingNode()).isTrue();
        server.verify();
    }

    @Test void providerFailureRetainsObservedLabel() throws Exception {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(envelope(LABEL, false), MediaType.APPLICATION_JSON));
        server.expect(requestTo(ENDPOINT)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        var result = mapper.readTree(new GeminiClient(new GeminiProperties("test", ENDPOINT), builder.build(), mapper, url -> "")
            .analyzeLabel(new byte[]{1}, "image/jpeg", null, null));
        assertThat(result.path("productName").asText()).isEqualTo("Vitamin");
        assertThat(result.at("/research/status").asText()).isEqualTo("SEARCH_UNAVAILABLE");
        server.verify();
    }

    @Test void backLabelAlsoResearchesProductWithoutReplacingPhotoFacts() throws Exception {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(envelope(LABEL, false), MediaType.APPLICATION_JSON));
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(envelope(REPORT, true), MediaType.APPLICATION_JSON));
        var result = mapper.readTree(new GeminiClient(new GeminiProperties("test", ENDPOINT), builder.build(), mapper, url -> "")
            .analyzeLabel(new byte[]{1}, "image/jpeg", new byte[]{2}, "image/jpeg"));
        assertThat(result.at("/research/status").asText()).isEqualTo("CANDIDATE");
        assertThat(result.path("ingredients").size()).isZero();
        server.verify();
    }

    @Test void guidanceUsesOnlyReferencedProviderCitationsAndKeepsInactiveMaterialsSeparate() throws Exception {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var report = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(REPORT);
        report.set("guidance", mapper.readTree("""
            {"overviewKo":"마그네슘을 보충하는 제품이에요.","routineTipKo":"라벨의 횟수에 맞춰 식사 시간에 연결해 보세요.",
             "cautionKo":"신장 질환이 있다면 확인해 주세요.","sourceIndices":[0,99],"sources":[{"url":"https://invented.example"}]}
            """));
        ((com.fasterxml.jackson.databind.node.ObjectNode) report.path("candidate")).putArray("otherIngredients").add("cellulose");
        ((com.fasterxml.jackson.databind.node.ArrayNode) report.at("/candidate/ingredients")).addObject().put("name", "cellulose").put("amount", "");
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(envelope(LABEL, false), MediaType.APPLICATION_JSON));
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(envelope(report.toString(), true), MediaType.APPLICATION_JSON));
        var result = mapper.readTree(new GeminiClient(new GeminiProperties("test", ENDPOINT), builder.build(), mapper, url -> "")
            .analyzeLabel(new byte[]{1}, "image/jpeg", null, null));
        assertThat(result.at("/productInformation/guidance/overviewKo").asText()).contains("마그네슘");
        assertThat(result.at("/productInformation/guidance/sources").size()).isEqualTo(1);
        assertThat(result.at("/productInformation/guidance/sources/0/url").asText()).isEqualTo("https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/");
        assertThat(result.at("/productInformation/otherIngredients/0").asText()).isEqualTo("cellulose");
        assertThat(result.at("/research/candidate/ingredients").size()).isEqualTo(1);
        server.verify();
    }

    @Test void nonOfficialSourcesCannotSupportClinicalGuidance() throws Exception {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var report = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(REPORT);
        report.set("guidance", mapper.readTree("{\"overviewKo\":\"섭취 한도를 높여도 돼요\",\"sourceIndices\":[0]}"));
        var response = envelope(report.toString(), true).replace("https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/", "https://industry-news.example/limit-proposal");
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(envelope("No official results", false), MediaType.APPLICATION_JSON));
        var result = new GeminiClient(new GeminiProperties("test", ENDPOINT), builder.build(), mapper, url -> "").researchProduct(mapper.createObjectNode());
        assertThat(result.path("guidance").isEmpty()).isTrue();
        server.verify();
    }

    @Test void shopOnlyProductLookupFetchesSeparateOfficialHealthEvidence() throws Exception {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var shop = envelope("MATCHED Example Vitamin 60 capsules, 1 tablet serving", true)
            .replace("https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/", "https://example.org/product");
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(shop, MediaType.APPLICATION_JSON));
        server.expect(requestTo(ENDPOINT)).andExpect(jsonPath("$.tools[0].google_search").exists())
            .andRespond(withSuccess(envelope("Official nutrient guidance [1]", true), MediaType.APPLICATION_JSON));
        var report = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(REPORT);
        report.set("guidance", mapper.readTree("{\"overviewKo\":\"성분을 쉽게 설명해요\",\"sourceIndices\":[1]}"));
        server.expect(requestTo(ENDPOINT)).andExpect(content().string(org.hamcrest.Matchers.containsString("officialPage")))
            .andRespond(withSuccess(envelope(report.toString(), false), MediaType.APPLICATION_JSON));
        var result = new GeminiClient(new GeminiProperties("test", ENDPOINT), builder.build(), mapper,
            url -> "Official guidance including the adult upper limit table").researchProduct(mapper.createObjectNode());
        assertThat(result.path("status").asText()).isEqualTo("CANDIDATE");
        assertThat(result.at("/guidance/overviewKo").asText()).isEqualTo("성분을 쉽게 설명해요");
        assertThat(result.at("/guidance/sources/0/url").asText()).contains("ods.od.nih.gov");
        server.verify();
    }

    @Test void guidanceWithoutSupportingSourceIndicesIsNotShown() throws Exception {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var report = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(REPORT);
        report.set("guidance", mapper.readTree("{\"overviewKo\":\"공복에 드세요\",\"sourceIndices\":[99]}"));
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(envelope(report.toString(), true), MediaType.APPLICATION_JSON));
        var result = new GeminiClient(new GeminiProperties("test", ENDPOINT), builder.build(), mapper, url -> "").researchProduct(mapper.createObjectNode());
        assertThat(result.path("guidance").isEmpty()).isTrue();
        server.verify();
    }

    @Test void equivalentUnitRowsShareOneIngredientAndPreserveOriginalText() throws Exception {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var report = mapper.readTree(REPORT);
        var ingredients = ((com.fasterxml.jackson.databind.node.ObjectNode) report.path("candidate")).putArray("ingredients");
        for (var unit : List.of("mcg", "IU")) {
            ingredients.addObject().put("name", "Vitamin D").put("amount", unit.equals("mcg") ? "50" : "2000")
                .put("unit", unit).put("originalText", "Vitamin D 50 mcg (2000 IU)");
        }
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(envelope(LABEL, false), MediaType.APPLICATION_JSON));
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(envelope(report.toString(), true), MediaType.APPLICATION_JSON));
        var result = mapper.readTree(new GeminiClient(new GeminiProperties("test", ENDPOINT), builder.build(), mapper, url -> "")
            .analyzeLabel(new byte[]{1}, "image/jpeg", null, null));
        assertThat(result.at("/research/candidate/ingredients").size()).isEqualTo(1);
        assertThat(result.at("/research/candidate/ingredients/0/originalText").asText()).contains("2000 IU");
        server.verify();
    }

    @Test void citedProseIsFormattedWithoutLosingRetrievalSources() throws Exception {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(envelope(LABEL, false), MediaType.APPLICATION_JSON));
        server.expect(requestTo(ENDPOINT)).andExpect(jsonPath("$.tools[0].google_search").exists())
            .andRespond(withSuccess(envelope("MATCHED. Example Vitamin, 60 capsules. Per tablet: C 100 mg. [1]", true), MediaType.APPLICATION_JSON));
        server.expect(requestTo(ENDPOINT)).andExpect(jsonPath("$.generationConfig.responseMimeType").value("application/json"))
            .andExpect(jsonPath("$.tools").doesNotExist())
            .andRespond(withSuccess(envelope(REPORT, false), MediaType.APPLICATION_JSON));
        var result = mapper.readTree(new GeminiClient(new GeminiProperties("test", ENDPOINT), builder.build(), mapper, url -> "")
            .analyzeLabel(new byte[]{1}, "image/jpeg", null, null));
        assertThat(result.at("/research/status").asText()).isEqualTo("CANDIDATE");
        assertThat(result.at("/research/groundedText").asText()).contains("Per tablet");
        assertThat(result.at("/research/sources/0/url").asText()).isEqualTo("https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/");
        server.verify();
    }
}
