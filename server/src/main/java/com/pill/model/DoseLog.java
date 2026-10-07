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
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "dose_log",
    uniqueConstraints = @UniqueConstraint(name = "uq_dose_log_once", columnNames = {"supplement_id", "dose_date", "dose_time"})
)
public class DoseLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplement_id", nullable = false)
    private UserSupplement supplement;

    @Column(name = "dose_date", nullable = false)
    private LocalDate doseDate;

    @Column(name = "dose_time", length = 20)
    private String doseTime;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "checked_at", nullable = false)
    private LocalDateTime checkedAt;

    @Column(columnDefinition = "text")
    private String memo;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected DoseLog() {
    }

    public DoseLog(UserSupplement supplement, LocalDate doseDate, String doseTime, String status, String memo) {
        this.supplement = supplement;
        this.doseDate = doseDate;
        this.doseTime = doseTime;
        this.status = status;
        this.memo = memo;
        this.checkedAt = LocalDateTime.now();
    }

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        if (checkedAt == null) {
            checkedAt = createdAt;
        }
    }

    public void update(String status, String memo) {
        this.status = status;
        this.memo = memo;
        this.checkedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public UserSupplement getSupplement() {
        return supplement;
    }

    public LocalDate getDoseDate() {
        return doseDate;
    }

    public String getStatus() {
        return status;
    }

    public String getDoseTime() {
        return doseTime;
    }

    public LocalDateTime getCheckedAt() {
        return checkedAt;
    }

    public String getMemo() {
        return memo;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
