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
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_supplement_ingredient")
public class UserSupplementIngredient {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplement_id", nullable = false)
    private UserSupplement supplement;

    @Column(nullable = false)
    private String name;

    @Column(length = 80)
    private String amount;

    @Column(length = 40)
    private String unit;

    @Column(name = "original_text", columnDefinition = "text")
    private String originalText;

    @Column(precision = 5, scale = 2)
    private BigDecimal confidence;

    @Column(name = "needs_review", nullable = false)
    private boolean needsReview;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected UserSupplementIngredient() {
    }

    public UserSupplementIngredient(
        String name,
        String amount,
        String unit,
        String originalText,
        double confidence,
        boolean needsReview
    ) {
        this.name = name;
        this.amount = amount;
        this.unit = unit;
        this.originalText = originalText;
        this.confidence = BigDecimal.valueOf(confidence);
        this.needsReview = needsReview;
    }

    void attachTo(UserSupplement supplement) {
        this.supplement = supplement;
    }

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public UserSupplement getSupplement() {
        return supplement;
    }

    public String getName() {
        return name;
    }

    public String getAmount() {
        return amount;
    }

    public String getUnit() {
        return unit;
    }

    public String getOriginalText() {
        return originalText;
    }

    public double getConfidence() {
        return confidence == null ? 0.0 : confidence.doubleValue();
    }

    public boolean isNeedsReview() {
        return needsReview;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
