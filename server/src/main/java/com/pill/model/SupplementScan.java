package com.pill.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "supplement_scan")
public class SupplementScan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "image_metadata", columnDefinition = "json")
    private String imageMetadata;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "raw_ai_response_json", columnDefinition = "json")
    private String rawAiResponseJson;

    @Column(name = "normalized_ai_result_json", columnDefinition = "json")
    private String normalizedAiResultJson;

    @Column(name = "failure_reason", columnDefinition = "text")
    private String failureReason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected SupplementScan() {
    }

    public SupplementScan(User user, String imageMetadata, String status) {
        this.user = user;
        this.imageMetadata = imageMetadata;
        this.status = status;
    }

    public SupplementScan(
        User user,
        String imageMetadata,
        String status,
        String rawAiResponseJson,
        String normalizedAiResultJson,
        String failureReason
    ) {
        this.user = user;
        this.imageMetadata = imageMetadata;
        this.status = status;
        this.rawAiResponseJson = rawAiResponseJson;
        this.normalizedAiResultJson = normalizedAiResultJson;
        this.failureReason = failureReason;
    }

    public void complete(String rawAiResponseJson, String normalizedAiResultJson) {
        this.status = "COMPLETED";
        this.rawAiResponseJson = rawAiResponseJson;
        this.normalizedAiResultJson = normalizedAiResultJson;
        this.failureReason = null;
    }

    public void updateProductInformation(String normalizedAiResultJson) {
        this.normalizedAiResultJson = normalizedAiResultJson;
    }

    public void fail(String failureReason) {
        this.status = "FAILED";
        this.failureReason = failureReason;
    }

    @PrePersist
    void prePersist() {
        var now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public String getImageMetadata() {
        return imageMetadata;
    }

    public String getStatus() {
        return status;
    }

    public String getRawAiResponseJson() {
        return rawAiResponseJson;
    }

    public String getNormalizedAiResultJson() {
        return normalizedAiResultJson;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
