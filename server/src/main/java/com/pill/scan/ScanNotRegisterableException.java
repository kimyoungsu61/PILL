package com.pill.scan;

final class ScanNotRegisterableException extends IllegalArgumentException {
    ScanNotRegisterableException() {
        super("scan is not a confirmed supplement");
    }
}
