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
@Table(name = "dose_schedule")
public class DoseSchedule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplement_id", nullable = false)
    private UserSupplement supplement;

    @Column(name = "recommended_time", length = 20)
    private String recommendedTime;

    @Column(name = "confirmed_time", length = 20)
    private String confirmedTime;

    @Column(name = "repeat_days", nullable = false, length = 80)
    private String repeatDays = "MON,TUE,WED,THU,FRI,SAT,SUN";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected DoseSchedule() {
    }

    public DoseSchedule(UserSupplement supplement, String recommendedTime, String confirmedTime) {
        this.supplement = supplement;
        this.recommendedTime = recommendedTime;
        this.confirmedTime = confirmedTime;
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

    public UserSupplement getSupplement() {
        return supplement;
    }

    public String getRecommendedTime() {
        return recommendedTime;
    }

    public String getConfirmedTime() {
        return confirmedTime;
    }

    public String getRepeatDays() {
        return repeatDays;
    }
}
