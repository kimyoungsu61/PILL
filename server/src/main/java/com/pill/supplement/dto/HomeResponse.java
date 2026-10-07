package com.pill.supplement.dto;

import java.util.List;

public record HomeResponse(
    List<SupplementSummary> supplements,
    List<TodayDose> todayDoses
) {
    public record SupplementSummary(
        Long id,
        String brandName,
        String productName,
        String displayNameKo,
        String imageUri,
        String warningSummary
    ) {
    }

    public record TodayDose(
        Long supplementId,
        String productName,
        String displayNameKo,
        String imageUri,
        String confirmedTime,
        String status
    ) {
    }
}
