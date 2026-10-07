package com.pill.auth;

class DuplicateEmailException extends IllegalArgumentException {
    DuplicateEmailException(String message) {
        super(message);
    }

    DuplicateEmailException(String message, Throwable cause) {
        super(message, cause);
    }
}
