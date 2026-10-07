package com.pill.supplement.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ExportDataResponse(
    String email,
    LocalDateTime generatedAt,
    List<Supplement> supplements,
    DoseHistoryResponse doseHistory
) {
    public record Supplement(
        Long id,
        String brandName,
        String productName,
        String displayNameKo,
        String suggestedUseKo,
        List<String> doseTimes,
        String warningSummary,
        LocalDateTime createdAt,
        List<Ingredient> ingredients,
        String servingBasisKo
    ) {
    }

    public record Ingredient(
        String name,
        String amount,
        String unit,
        boolean needsReview
    ) {
    }
}
