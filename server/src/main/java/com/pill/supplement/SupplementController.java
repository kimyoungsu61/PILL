package com.pill.supplement;

import com.pill.auth.CurrentUser;
import com.pill.supplement.dto.DoseHistoryResponse;
import com.pill.supplement.dto.ExportDataResponse;
import com.pill.supplement.dto.DoseLogRequest;
import com.pill.supplement.dto.HomeResponse;
import com.pill.supplement.dto.ManualSupplementRequest;
import com.pill.supplement.dto.SupplementDetailResponse;
import com.pill.supplement.dto.UpdateDoseTimesRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import static com.pill.common.ValidationPatterns.OPTIONAL_CLOCK_TIME;

@RestController
@Validated
public class SupplementController {
    private final SupplementService supplements;

    public SupplementController(SupplementService supplements) {
        this.supplements = supplements;
    }

    @GetMapping("/api/home")
    public HomeResponse home(@CurrentUser Long userId) {
        return supplements.home(userId);
    }

    @GetMapping("/api/supplements")
    public List<HomeResponse.SupplementSummary> list(@CurrentUser Long userId) {
        return supplements.list(userId);
    }

    @GetMapping("/api/dose-history")
    public DoseHistoryResponse doseHistory(
        @CurrentUser Long userId,
        @RequestParam(defaultValue = "30") @Min(7) @Max(90) int days
    ) {
        return supplements.doseHistory(userId, days);
    }

    @GetMapping("/api/export")
    public ExportDataResponse export(
        @CurrentUser Long userId,
        @RequestParam(defaultValue = "30") @Min(7) @Max(90) int days
    ) {
        return supplements.exportData(userId, days);
    }

    @GetMapping("/api/supplements/{id}")
    public SupplementDetailResponse detail(@CurrentUser Long userId, @PathVariable @Positive Long id) {
        return supplements.detail(userId, id);
    }

    @PostMapping("/api/supplements/{id}/dose-logs")
    public void logDose(
        @CurrentUser Long userId,
        @PathVariable @Positive Long id,
        @Valid @RequestBody DoseLogRequest request
    ) {
        supplements.logDose(userId, id, request);
    }

    @DeleteMapping("/api/supplements/{id}/dose-logs")
    public void clearDoseLog(
        @CurrentUser Long userId,
        @PathVariable @Positive Long id,
        @RequestParam(required = false) @Size(max = 5) @Pattern(regexp = OPTIONAL_CLOCK_TIME) String doseTime
    ) {
        supplements.clearDoseLog(userId, id, doseTime);
    }

    @PostMapping("/api/supplements/manual")
    public Long createManual(@CurrentUser Long userId, @Valid @RequestBody ManualSupplementRequest request) {
        return supplements.createManualSupplement(userId, request);
    }

    @PatchMapping("/api/supplements/{id}/dose-times")
    public void updateDoseTimes(
        @CurrentUser Long userId,
        @PathVariable @Positive Long id,
        @Valid @RequestBody UpdateDoseTimesRequest request
    ) {
        supplements.updateDoseTimes(userId, id, request);
    }

    @DeleteMapping("/api/supplements/{id}")
    public void delete(@CurrentUser Long userId, @PathVariable @Positive Long id) {
        supplements.deleteSupplement(userId, id);
    }
}
