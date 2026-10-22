package com.pill.scan;

public class ScanAnalysisFailedException extends RuntimeException {
    public ScanAnalysisFailedException(RuntimeException cause) {
        super("analysis failed", cause);
    }
}
