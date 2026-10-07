package com.pill.auth;

class InvalidCredentialsException extends IllegalArgumentException {
    InvalidCredentialsException(String message) {
        super(message);
    }
}
