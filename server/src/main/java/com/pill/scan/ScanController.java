package com.pill.scan;

import com.pill.auth.CurrentUser;
import com.pill.scan.dto.ConfirmScanRequest;
import com.pill.scan.dto.ScanHistoryResponse;
import com.pill.scan.dto.ScanResultResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/scans")
@Validated
public class ScanController {
    private final ScanService scans;
    private final ScanRateLimiter rateLimiter;
    private final ImageUploadValidator images;

    public ScanController(ScanService scans, ScanRateLimiter rateLimiter, ImageUploadValidator images) {
        this.scans = scans;
        this.rateLimiter = rateLimiter;
        this.images = images;
    }

    @PostMapping
    public ScanResultResponse create(
        @CurrentUser Long userId,
        @RequestParam("frontImage") MultipartFile frontImage,
        @RequestParam(value = "backImage", required = false) MultipartFile backImage
    ) {
        rateLimiter.consume(userId);
        var front = images.validate(frontImage, "front");
        var back = backImage == null ? null : images.validate(backImage, "back");
        return scans.analyze(userId, front, back);
    }

    @GetMapping
    public ScanHistoryResponse history(@CurrentUser Long userId) {
        return scans.history(userId);
    }

    @GetMapping("/{scanId}")
    public ScanResultResponse get(@CurrentUser Long userId, @PathVariable @Positive Long scanId) {
        return scans.get(userId, scanId);
    }

    @PutMapping("/{scanId}/confirmed")
    public Long confirm(
        @CurrentUser Long userId,
        @PathVariable @Positive Long scanId,
        @Valid @RequestBody ConfirmScanRequest request
    ) {
        return scans.confirm(userId, scanId, request);
    }
}
