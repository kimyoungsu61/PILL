package com.pill.supplement.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record DoseHistoryResponse(
    LocalDate from,
    LocalDate to,
    Summary summary,
    List<Entry> entries
) {
    public record Summary(
        long total,
        long taken,
        long skipped,
        long missed,
        int completionRate
    ) {
    }

    public record Entry(
        Long supplementId,
        String productName,
        String displayNameKo,
        String imageUri,
        LocalDate doseDate,
        String doseTime,
        String status,
        String memo,
        LocalDateTime checkedAt
    ) {
    }
}
