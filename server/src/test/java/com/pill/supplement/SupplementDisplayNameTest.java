package com.pill.supplement;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SupplementDisplayNameTest {
    @Test
    void probioticProductNameWinsOverMagnesiumStearateOtherIngredient() {
        var displayName = SupplementDisplayName.choose(
            "55B PROBIOTICS with Digestive Enzymes",
            List.of("Total Probiotic Blend", "Lactobacillus acidophilus", "Magnesium stearate")
        );

        assertThat(displayName).isEqualTo("유산균");
    }
}
