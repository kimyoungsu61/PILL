package com.pill.model;

/** Explicit user records; an absent log is never an UNKNOWN record. */
public enum DoseStatus {
    TAKEN, SKIPPED, UNKNOWN;

    public static boolean isRecorded(String status) {
        return "TAKEN".equals(status) || "SKIPPED".equals(status) || "UNKNOWN".equals(status);
    }
}
