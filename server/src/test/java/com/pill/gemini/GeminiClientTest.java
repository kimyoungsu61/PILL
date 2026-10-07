package com.pill.gemini;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GeminiClientTest {
    private static final String ENDPOINT =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    @Test
    void sendsApiKeyOnlyInHeaderAndExtractsText() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var client = new GeminiClient(
            new GeminiProperties("test-api-key", ENDPOINT),
            builder.build(),
            new ObjectMapper()
        );
        server.expect(requestTo(ENDPOINT))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("x-goog-api-key", "test-api-key"))
            .andExpect(request -> {
                assertThat(request.getURI().getQuery()).isNull();
                assertThat(request.getURI().toString()).doesNotContain("test-api-key", "key=");
            })
            .andRespond(withSuccess("""
                {
                  "candidates": [
                    {"content": {"parts": [{"text": "{\\\"productName\\\":\\\"Vitamin C\\\"}"}]}}
                  ]
                }
                """, MediaType.APPLICATION_JSON));

        var result = client.analyzeLabel(new byte[] {1, 2, 3}, "image/jpeg", null, null);

        assertThat(result).contains("\"productName\":\"Vitamin C\"", "NEEDS_MORE_LABEL");
        server.verify();
    }

    @Test
    void rejectsOversizedProviderResponsesBeforeJsonParsing() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var client = new GeminiClient(
            new GeminiProperties("test-api-key", ENDPOINT),
            builder.build(),
            new ObjectMapper()
        );
        server.expect(requestTo(ENDPOINT))
            .andRespond(withSuccess("x".repeat(250_001), MediaType.TEXT_PLAIN));

        assertThatThrownBy(() -> client.analyzeLabel(new byte[] {1}, "image/jpeg", null, null))
            .isInstanceOf(GeminiResponseException.class)
            .hasMessageContaining("too large");
    }

    @Test
    void rejectsProviderResponsesWithoutTextContent() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var client = new GeminiClient(
            new GeminiProperties("test-api-key", ENDPOINT),
            builder.build(),
            new ObjectMapper()
        );
        server.expect(requestTo(ENDPOINT))
            .andRespond(withSuccess("{\"candidates\":[]}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.analyzeLabel(new byte[] {1}, "image/jpeg", null, null))
            .isInstanceOf(GeminiResponseException.class);
    }

    @Test
    void rejectsUnsafeEndpointOverrides() {
        assertThatThrownBy(() -> new GeminiProperties(
            "key",
            "http://generativelanguage.googleapis.com/v1beta/models/test"
        )).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new GeminiProperties(
            "key",
            "https://generativelanguage.googleapis.com.evil.example/v1beta/models/test"
        )).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new GeminiProperties(
            "key",
            "https://user@generativelanguage.googleapis.com/v1beta/models/test"
        )).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new GeminiProperties(
            "key",
            ENDPOINT + "?key=leaked"
        )).isInstanceOf(IllegalArgumentException.class);
    }
}
