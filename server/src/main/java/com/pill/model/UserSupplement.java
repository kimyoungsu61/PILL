package com.pill.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "user_supplement")
public class UserSupplement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scan_id", nullable = false)
    private SupplementScan scan;

    @Column(name = "brand_name")
    private String brandName;

    @Column(name = "product_name")
    private String productName;

    @Column(name = "display_name_ko")
    private String displayNameKo;

    @Column(name = "image_uri", columnDefinition = "text")
    private String imageUri;

    @Column(name = "suggested_use_ko", columnDefinition = "text")
    private String suggestedUseKo;

    @Column(name = "suggested_use_original", columnDefinition = "text")
    private String suggestedUseOriginal;

    @Column(name = "serving_basis_ko", length = 255)
    private String servingBasisKo;

    @Column(name = "summary_ko", columnDefinition = "text")
    private String summaryKo;

    @Column(name = "original_label_text", columnDefinition = "mediumtext")
    private String originalLabelText;

    @Column(name = "warning_summary", columnDefinition = "text")
    private String warningSummary;

    @Column(name = "confirmed_dose_time", length = 20)
    private String confirmedDoseTime;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "supplement", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<UserSupplementIngredient> ingredients = new ArrayList<>();

    protected UserSupplement() {
    }

    public UserSupplement(
        User user,
        SupplementScan scan,
        String brandName,
        String productName,
        String suggestedUseKo,
        String suggestedUseOriginal,
        String summaryKo,
        String originalLabelText,
        String warningSummary,
        String confirmedDoseTime
    ) {
        this(
            user,
            scan,
            brandName,
            productName,
            "",
            "",
            suggestedUseKo,
            suggestedUseOriginal,
            summaryKo,
            originalLabelText,
            warningSummary,
            confirmedDoseTime
        );
    }

    public UserSupplement(
        User user,
        SupplementScan scan,
        String brandName,
        String productName,
        String displayNameKo,
        String imageUri,
        String suggestedUseKo,
        String suggestedUseOriginal,
        String summaryKo,
        String originalLabelText,
        String warningSummary,
        String confirmedDoseTime
    ) {
        this.user = user;
        this.scan = scan;
        this.brandName = brandName;
        this.productName = productName;
        this.displayNameKo = displayNameKo;
        this.imageUri = imageUri;
        this.suggestedUseKo = suggestedUseKo;
        this.suggestedUseOriginal = suggestedUseOriginal;
        this.summaryKo = summaryKo;
        this.originalLabelText = originalLabelText;
        this.warningSummary = warningSummary;
        this.confirmedDoseTime = confirmedDoseTime;
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

    public void addIngredient(UserSupplementIngredient ingredient) {
        ingredient.attachTo(this);
        ingredients.add(ingredient);
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public SupplementScan getScan() {
        return scan;
    }

    public String getBrandName() {
        return brandName;
    }

    public String getProductName() {
        return productName;
    }

    public String getDisplayNameKo() {
        return displayNameKo;
    }

    public String getImageUri() {
        return imageUri;
    }

    public String getSuggestedUseKo() {
        return suggestedUseKo;
    }

    public String getSuggestedUseOriginal() {
        return suggestedUseOriginal;
    }

    public String getServingBasisKo() {
        return servingBasisKo;
    }

    public void updateServingBasisKo(String servingBasisKo) {
        this.servingBasisKo = servingBasisKo;
    }

    public String getSummaryKo() {
        return summaryKo;
    }

    public String getOriginalLabelText() {
        return originalLabelText;
    }

    public String getWarningSummary() {
        return warningSummary;
    }

    public String getConfirmedDoseTime() {
        return confirmedDoseTime;
    }

    public void updateConfirmedDoseTime(String confirmedDoseTime) {
        this.confirmedDoseTime = confirmedDoseTime;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public List<UserSupplementIngredient> getIngredients() {
        return List.copyOf(ingredients);
    }
}
