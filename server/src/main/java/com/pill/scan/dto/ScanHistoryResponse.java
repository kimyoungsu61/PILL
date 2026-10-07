package com.pill.scan.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ScanHistoryResponse(
    Summary summary,
    List<Entry> entries
) {
    public record Summary(
        int total,
        int saved,
        int needsReview,
        int failed
    ) {
    }

    public record Entry(
        Long scanId,
        String status,
        String brandName,
        String productName,
        String displayNameKo,
        String imageUri,
        boolean saved,
        Long supplementId,
        int ingredientCount,
        int reviewIngredientCount,
        boolean hasWarnings,
        LocalDateTime createdAt
    ) {
    }
}
