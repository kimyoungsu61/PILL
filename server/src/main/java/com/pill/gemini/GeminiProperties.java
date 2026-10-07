package com.pill.gemini;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;

@ConfigurationProperties(prefix = "pill.gemini")
public record GeminiProperties(String apiKey, String endpoint) {
    private static final String ALLOWED_HOST = "generativelanguage.googleapis.com";

    public GeminiProperties {
        var uri = parseEndpoint(endpoint);
        if (!"https".equalsIgnoreCase(uri.getScheme())
            || !ALLOWED_HOST.equalsIgnoreCase(uri.getHost())
            || uri.getRawUserInfo() != null
            || (uri.getPort() != -1 && uri.getPort() != 443)
            || uri.getRawQuery() != null
            || uri.getRawFragment() != null) {
            throw new IllegalArgumentException("Gemini endpoint must use the approved HTTPS host");
        }
        endpoint = uri.toASCIIString();
    }

    private static URI parseEndpoint(String endpoint) {
        try {
            return URI.create(endpoint == null ? "" : endpoint);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Gemini endpoint is invalid", exception);
        }
    }

    public URI endpointUri() {
        return URI.create(endpoint);
    }
}
