package com.pill.supplement.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record SupplementDetailResponse(
    Long id,
    String brandName,
    String productName,
    String displayNameKo,
    String imageUri,
    String suggestedUseKo,
    String suggestedUseOriginal,
    String summaryKo,
    String originalLabelText,
    String warningSummary,
    String confirmedDoseTime,
    List<Ingredient> ingredients,
    List<DoseLogEntry> doseLogs,
    String servingBasisKo,
    com.fasterxml.jackson.databind.JsonNode productInformation
) {
    public record Ingredient(
        String name,
        String amount,
        String unit,
        String originalText,
        double confidence,
        boolean needsReview
    ) {
    }

    public record DoseLogEntry(LocalDate doseDate, String doseTime, String status, String memo, LocalDateTime checkedAt) {
    }
}
