package com.pill.common;

public final class ValidationPatterns {
    public static final String CLOCK_TIME = "^(?:[01]\\d|2[0-3]):[0-5]\\d$";
    public static final String OPTIONAL_CLOCK_TIME = "^(?:|(?:[01]\\d|2[0-3]):[0-5]\\d)$";
    public static final String CLOCK_TIME_LIST =
        "^(?:[01]\\d|2[0-3]):[0-5]\\d(?:,(?:[01]\\d|2[0-3]):[0-5]\\d){0,2}$";

    private ValidationPatterns() {
    }
}
