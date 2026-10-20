package com.pill.gemini;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GeminiProductImagesTest {
    private static final String ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    @Test void searchLinksRemainAvailableWhenProseHasAPreambleAndNoTextCitationOffsets() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess("""
            {"candidates":[{"content":{"parts":[{"text":"The product report follows. MATCHED: Nanowell Hovenia-Rx."}]},
              "groundingMetadata":{"groundingChunks":[{"web":{"uri":"https://mynanowell.com/products/hovenia-rx-milkthistle-tablet","title":"Nanowell"}}]}}]}
            """, MediaType.APPLICATION_JSON));
        var json = new ObjectMapper();
        var client = new GeminiClient(new GeminiProperties("test", ENDPOINT), builder.build(), json, url -> "");
        assertThat(client.productImageSources(json.createObjectNode()).get(0).path("uri").asText())
            .isEqualTo("https://mynanowell.com/products/hovenia-rx-milkthistle-tablet");
        server.verify();
    }

    @Test void photoLookupUsesSearchButAcceptsOnlyProviderGroundingLinks() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(ENDPOINT)).andExpect(jsonPath("$.tools[0].google_search").exists())
            .andRespond(withSuccess("""
                {"candidates":[{"content":{"parts":[{"text":"MATCHED Image: https://invented.example/product.jpg"}]},
                  "groundingMetadata":{"groundingChunks":[{"web":{"uri":"https://doctorsbest.com/products/magnesium","title":"Product"}}],
                    "groundingSupports":[{"groundingChunkIndices":[0]}]}}]}
                """, MediaType.APPLICATION_JSON));
        var json = new ObjectMapper();
        var client = new GeminiClient(new GeminiProperties("test", ENDPOINT), builder.build(), json, url -> "");
        var result = client.productImageSources(json.createObjectNode().put("brandName", "Doctor's Best"));
        assertThat(result.size()).isEqualTo(1);
        assertThat(result.get(0).path("uri").asText()).isEqualTo("https://doctorsbest.com/products/magnesium");
        assertThat(result.toString()).doesNotContain("invented.example");
        server.verify();
    }
}
