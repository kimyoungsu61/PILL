package com.pill.common;

public class UploadTooLargeException extends RuntimeException {
    public UploadTooLargeException() {
        super("upload is too large");
    }
}
