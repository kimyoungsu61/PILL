package com.pill.supplement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

import static com.pill.common.ValidationPatterns.CLOCK_TIME;

public record UpdateDoseTimesRequest(
    @NotNull @Size(min = 1, max = 3)
    List<@NotBlank @Size(max = 5) @Pattern(regexp = CLOCK_TIME) String> doseTimes
) {
}
