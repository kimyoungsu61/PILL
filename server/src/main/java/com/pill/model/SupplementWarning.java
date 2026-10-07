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

import java.time.LocalDateTime;

@Entity
@Table(name = "supplement_warning")
public class SupplementWarning {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplement_id", nullable = false)
    private UserSupplement supplement;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private BlockedIngredient ingredient;

    @Column(name = "matched_text", nullable = false)
    private String matchedText;

    @Column(name = "warning_message", nullable = false, columnDefinition = "text")
    private String warningMessage;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected SupplementWarning() {
    }

    public SupplementWarning(
        UserSupplement supplement,
        BlockedIngredient ingredient,
        String matchedText,
        String warningMessage
    ) {
        this.supplement = supplement;
        this.ingredient = ingredient;
        this.matchedText = matchedText;
        this.warningMessage = warningMessage;
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

    public BlockedIngredient getIngredient() {
        return ingredient;
    }

    public String getMatchedText() {
        return matchedText;
    }

    public String getWarningMessage() {
        return warningMessage;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
