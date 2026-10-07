package com.pill.auth;

public class InvalidSessionException extends RuntimeException {
    public InvalidSessionException() {
        super("invalid session");
    }
}
