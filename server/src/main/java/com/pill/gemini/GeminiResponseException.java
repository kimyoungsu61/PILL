package com.pill.gemini;

public class GeminiResponseException extends RuntimeException {
    public GeminiResponseException(String message) {
        super(message);
    }

    public GeminiResponseException(String message, Throwable cause) {
        super(message, cause);
    }
}
