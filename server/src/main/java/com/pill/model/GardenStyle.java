package com.pill.model;

import jakarta.persistence.*;

@Entity
@Table(name = "garden_style")
public class GardenStyle {
    @Id @Column(name = "user_id")
    private Long userId;
    @Column(nullable = false, length = 20)
    private String pot = "clay";
    @Column(nullable = false, length = 20)
    private String stamp = "leaf";

    protected GardenStyle() {}
    public GardenStyle(Long userId) { this.userId = userId; }
    public String getPot() { return pot; }
    public String getStamp() { return stamp; }
    public void update(String pot, String stamp) { this.pot = pot; this.stamp = stamp; }
}
