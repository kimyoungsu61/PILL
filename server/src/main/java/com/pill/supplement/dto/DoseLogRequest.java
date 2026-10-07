package com.pill.supplement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import static com.pill.common.ValidationPatterns.OPTIONAL_CLOCK_TIME;

public record DoseLogRequest(
    @NotBlank @Pattern(regexp = "^(?:TAKEN|SKIPPED)$") String status,
    @Size(max = 1_000) String memo,
    @Size(max = 5) @Pattern(regexp = OPTIONAL_CLOCK_TIME) String doseTime
) {
    public DoseLogRequest(String status, String memo) {
        this(status, memo, null);
    }
}
