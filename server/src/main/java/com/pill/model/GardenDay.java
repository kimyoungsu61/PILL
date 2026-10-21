package com.pill.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.Collection;

/**
 * One durable entry per user/day. Completion keys are deliberately not foreign
 * keys to products: deleting a product must not erase a previously earned day.
 */
@Entity
@Table(name = "garden_day", uniqueConstraints = @UniqueConstraint(
    name = "uq_garden_day", columnNames = {"user_id", "stamp_date"}))
public class GardenDay {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Column(name = "stamp_date", nullable = false)
    private LocalDate stampDate;
    @Column(nullable = false)
    private boolean earned;
    @Column(name = "completion_keys", nullable = false, columnDefinition = "text")
    private String completionKeys = "";

    protected GardenDay() {}
    public GardenDay(User user, LocalDate date) { this.user = user; this.stampDate = date; }
    public LocalDate getStampDate() { return stampDate; }
    public boolean isEarned() { return earned; }
    public void earn(Collection<String> keys) {
        earned = true;
        completionKeys = "\n" + String.join("\n", keys) + "\n";
    }
    public void undo(String key) {
        if (earned && completionKeys.contains("\n" + key + "\n")) {
            earned = false;
            completionKeys = "";
        }
    }
}
