package com.pill.scan.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

import static com.pill.common.ValidationPatterns.CLOCK_TIME_LIST;

public record ConfirmScanRequest(
    @Size(max = 255) String brandName,
    @NotBlank @Size(max = 255) String productName,
    @Size(max = 10_000) String suggestedUseKo,
    @Size(max = 10_000) String suggestedUseOriginal,
    @Size(max = 10_000) String summaryKo,
    @Size(max = 20_000) String originalLabelText,
    @Size(max = 10_000) String warningSummary,
    @NotBlank @Pattern(regexp = CLOCK_TIME_LIST) String confirmedDoseTime,
    @Valid @Size(max = 100) List<@NotNull Ingredient> ingredients,
    @Size(max = 2_048) String imageUri,
    @Size(max = 255) String servingBasisKo
) {
    public ConfirmScanRequest(String brandName, String productName, String suggestedUseKo,
        String suggestedUseOriginal, String summaryKo, String originalLabelText,
        String warningSummary, String confirmedDoseTime, List<Ingredient> ingredients, String imageUri) {
        this(brandName, productName, suggestedUseKo, suggestedUseOriginal, summaryKo,
            originalLabelText, warningSummary, confirmedDoseTime, ingredients, imageUri, null);
    }

    public record Ingredient(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 80) String amount,
        @Size(max = 40) String unit,
        @Size(max = 10_000) String originalText,
        @DecimalMin("0.0") @DecimalMax("1.0") double confidence,
        boolean needsReview
    ) {
    }
}
