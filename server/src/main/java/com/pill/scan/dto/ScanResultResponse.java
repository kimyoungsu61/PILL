package com.pill.scan.dto;

import java.util.List;

public record ScanResultResponse(
    Long scanId,
    String status,
    String brandName,
    String productName,
    String suggestedUseKo,
    String suggestedUseOriginal,
    String warningsKo,
    String warningsOriginal,
    String originalLabelText,
    String recommendedDoseTime,
    List<Ingredient> ingredients,
    com.fasterxml.jackson.databind.JsonNode research,
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
}
