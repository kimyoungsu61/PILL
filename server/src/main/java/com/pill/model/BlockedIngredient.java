package com.pill.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "blocked_ingredient")
public class BlockedIngredient {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false, columnDefinition = "json")
    private String aliases;

    @Column(name = "warning_message", nullable = false, columnDefinition = "text")
    private String warningMessage;

    @Column(name = "source_note", columnDefinition = "text")
    private String sourceNote;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected BlockedIngredient() {
    }

    public BlockedIngredient(String name, String aliases, String warningMessage, String sourceNote) {
        this.name = name;
        this.aliases = aliases;
        this.warningMessage = warningMessage;
        this.sourceNote = sourceNote;
    }

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getAliases() {
        return aliases;
    }

    public String getWarningMessage() {
        return warningMessage;
    }

    public String getSourceNote() {
        return sourceNote;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
