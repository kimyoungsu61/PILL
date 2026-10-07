package com.pill.gemini;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

@Configuration(proxyBeanMethods = false)
public class GeminiClientConfig {
    @Bean("geminiRestClient")
    RestClient geminiRestClient() {
        var httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
        var requestFactory = new JdkClientHttpRequestFactory(httpClient);
        // Extraction, grounded retrieval and formatting run sequentially (at most 90s).
        requestFactory.setReadTimeout(Duration.ofSeconds(30));
        return RestClient.builder()
            .requestFactory(requestFactory)
            .build();
    }
}
