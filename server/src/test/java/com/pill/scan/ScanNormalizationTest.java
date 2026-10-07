package com.pill.scan;

import org.junit.jupiter.api.Test;

import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScanNormalizationTest {
    @Test
    void normalizePreservesProductNameAndFlagsLowConfidenceIngredient() {
        var rawJson = """
            {
              "brandName": "Healthy Labs",
              "productName": "Morning Vitamin",
              "suggestedUseOriginal": "Take one tablet daily with food.",
              "suggestedUseKo": "Take one tablet daily with food.",
              "warningsOriginal": "Consult a doctor if pregnant.",
              "warningsKo": "Consult a doctor if pregnant.",
              "originalLabelText": "Supplement Facts: Vitamin C 500 mg",
              "recommendedDoseTime": "MORNING",
              "ingredients": [
                {
                  "name": "Vitamin C",
                  "amount": "500",
                  "unit": "mg",
                  "originalText": "Vitamin C 500 mg",
                  "confidence": 0.62
                }
              ]
            }
            """;

        var result = ScanService.normalize(rawJson);

        assertThat(result.productName()).isEqualTo("Morning Vitamin");
        assertThat(result.ingredients()).singleElement()
            .satisfies(ingredient -> {
                assertThat(ingredient.name()).isEqualTo("Vitamin C");
                assertThat(ingredient.confidence()).isEqualTo(0.62);
                assertThat(ingredient.needsReview()).isTrue();
            });
    }

    @Test
    void normalizeAcceptsGeminiMarkdownJsonFence() {
        var rawJson = """
            ```json
            {
              "productName": "Evening Magnesium",
              "ingredients": []
            }
            ```
            """;

        var result = ScanService.normalize(rawJson);

        assertThat(result.productName()).isEqualTo("Evening Magnesium");
        assertThat(result.ingredients()).isEmpty();
    }

    @Test
    void normalizeTreatsMissingAndNonArrayIngredientsAsEmpty() {
        var missingIngredients = """
            {
              "brandName": "Plain Labs"
            }
            """;
        var nonArrayIngredients = """
            {
              "brandName": "Plain Labs",
              "ingredients": {
                "name": "Vitamin D"
              }
            }
            """;

        assertThat(ScanService.normalize(missingIngredients).ingredients()).isEmpty();
        assertThat(ScanService.normalize(nonArrayIngredients).ingredients()).isEmpty();
    }

    @Test
    void normalizeOnlyFlagsIngredientConfidenceBelowThreshold() {
        var rawJson = """
            {
              "ingredients": [
                { "name": "Vitamin D", "confidence": 0.79 },
                { "name": "Magnesium", "confidence": 0.8 },
                { "name": "Zinc", "confidence": 0.91 }
              ]
            }
            """;

        var result = ScanService.normalize(rawJson);

        assertThat(result.ingredients())
            .extracting(ScanService.IngredientResult::needsReview)
            .containsExactly(true, false, false);
    }

    @Test
    void normalizeDefaultsMissingVitaminDoseTimeToMorning() {
        var rawJson = """
            {
              "brandName": "Jongkundang",
              "productName": "Multi Vita Booster Shot",
              "suggestedUseKo": "1일 1회 섭취",
              "recommendedDoseTime": "",
              "ingredients": [
                { "name": "Vitamin C", "amount": "1000", "unit": "mg", "confidence": 0.91 }
              ]
            }
            """;

        var result = ScanService.normalize(rawJson);

        assertThat(result.recommendedDoseTime()).isEqualTo("09:00");
    }

    @Test
    void normalizeDefaultsMagnesiumDoseTimeToEvening() {
        var rawJson = """
            {
              "productName": "Evening Magnesium",
              "suggestedUseKo": "하루 1정 섭취",
              "recommendedDoseTime": "with meal",
              "ingredients": [
                { "name": "Magnesium", "amount": "300", "unit": "mg", "confidence": 0.88 }
              ]
            }
            """;

        var result = ScanService.normalize(rawJson);

        assertThat(result.recommendedDoseTime()).isEqualTo("21:00");
    }

    @Test
    void normalizeDefaultsProbioticDoseTimeBeforeMagnesiumStearateOtherIngredient() {
        var rawJson = """
            {
              "brandName": "Nanowell",
              "productName": "55B PROBIOTICS with Digestive Enzymes",
              "suggestedUseKo": "매일 음식과 함께 캡슐 1개를 섭취하십시오.",
              "recommendedDoseTime": "",
              "ingredients": [
                { "name": "Total Probiotic Blend", "amount": "55", "unit": "Billion CFU", "confidence": 0.95 },
                { "name": "Magnesium stearate", "confidence": 0.9 }
              ]
            }
            """;

        var result = ScanService.normalize(rawJson);

        assertThat(result.recommendedDoseTime()).isEqualTo("08:00");
    }

    @Test
    void normalizeDoesNotUseMagnesiumStearateAsProbioticProductName() {
        var rawJson = """
            {
              "brandName": "Healthy Gut",
              "productName": "Magnesium",
              "suggestedUseOriginal": "Probiotic supplement. Other ingredients: magnesium stearate.",
              "originalLabelText": "55B PROBIOTICS with Lactobacillus. Other ingredients: magnesium stearate.",
              "ingredients": [
                { "name": "Lactobacillus acidophilus", "confidence": 0.92 },
                { "name": "Magnesium stearate", "confidence": 0.9 }
              ]
            }
            """;

        var result = ScanService.normalize(rawJson);

        assertThat(result.productName()).isEqualTo("Probiotics");
        assertThat(result.recommendedDoseTime()).isEqualTo("08:00");
    }

    @Test
    void normalizeConvertsGeminiConfidenceScalesToProbability() {
        var rawJson = """
            {
              "ingredients": [
                { "name": "Five Point Scale", "confidence": 5 },
                { "name": "Percent Scale", "confidence": 95 },
                { "name": "Invalid Negative", "confidence": -1 }
              ]
            }
            """;

        var result = ScanService.normalize(rawJson);

        assertThat(result.ingredients())
            .extracting(ScanService.IngredientResult::confidence)
            .containsExactly(1.0, 0.95, 0.0);
    }

    @Test
    void normalizeDefaultsMissingTextFieldsAndSkipsNonObjectIngredients() {
        var rawJson = """
            {
              "ingredients": [
                "not an ingredient",
                { "name": "Vitamin C" }
              ]
            }
            """;

        var result = ScanService.normalize(rawJson);

        assertThat(result.brandName()).isEmpty();
        assertThat(result.ingredients()).singleElement()
            .satisfies(ingredient -> {
                assertThat(ingredient.name()).isEqualTo("Vitamin C");
                assertThat(ingredient.amount()).isEmpty();
                assertThat(ingredient.unit()).isEmpty();
                assertThat(ingredient.originalText()).isEmpty();
                assertThat(ingredient.confidence()).isZero();
                assertThat(ingredient.needsReview()).isTrue();
            });
    }

    @Test
    void normalizeRejectsInvalidJsonWithCause() {
        assertThatThrownBy(() -> ScanService.normalize("not json"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("invalid Gemini JSON")
            .hasCauseInstanceOf(Exception.class);
    }

    @Test
    void normalizeReadsAtMostOneHundredIngredients() {
        var ingredients = IntStream.range(0, 101)
            .mapToObj(index -> "{\"name\":\"Ingredient " + index + "\",\"confidence\":0.9}")
            .collect(Collectors.joining(","));

        var result = ScanService.normalize("{\"ingredients\":[" + ingredients + "]}");

        assertThat(result.ingredients()).hasSize(100);
        assertThat(result.ingredients().getLast().name()).isEqualTo("Ingredient 99");
    }

    @Test
    void normalizeTruncatesProviderStringsToPersistenceLimits() {
        var result = ScanService.normalize("""
            {
              "brandName": "%s",
              "productName": "%s",
              "suggestedUseKo": "%s",
              "originalLabelText": "%s",
              "ingredients": [
                {
                  "name": "%s",
                  "amount": "%s",
                  "unit": "%s",
                  "originalText": "%s",
                  "confidence": 0.9
                }
              ]
            }
            """.formatted(
                "b".repeat(256),
                "p".repeat(256),
                "s".repeat(10_001),
                "l".repeat(20_001),
                "n".repeat(256),
                "a".repeat(81),
                "u".repeat(41),
                "o".repeat(10_001)
            ));

        assertThat(result.brandName()).hasSize(255);
        assertThat(result.productName()).hasSize(255);
        assertThat(result.suggestedUseKo()).hasSize(10_000);
        assertThat(result.originalLabelText()).hasSize(20_000);
        assertThat(result.ingredients()).singleElement().satisfies(ingredient -> {
            assertThat(ingredient.name()).hasSize(255);
            assertThat(ingredient.amount()).hasSize(80);
            assertThat(ingredient.unit()).hasSize(40);
            assertThat(ingredient.originalText()).hasSize(10_000);
        });
    }

    @Test
    void normalizeRejectsPayloadsOverTwoHundredFiftyThousandCharacters() {
        assertThatThrownBy(() -> ScanService.normalize("x".repeat(250_001)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("too large");
    }
}
