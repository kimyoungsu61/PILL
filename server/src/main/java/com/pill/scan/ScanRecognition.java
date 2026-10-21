package com.pill.scan;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.Locale;
import java.util.Set;

/** A photographed target's identity. Registration permission is always derived by the server. */
public record ScanRecognition(
    String category,
    String displayName,
    double confidence,
    String messageKo,
    boolean registrationAllowed
) {
    private static final Set<String> CATEGORIES = Set.of(
        "SUPPLEMENT", "ALCOHOL", "BEVERAGE", "FOOD", "MEDICINE", "OTHER", "UNKNOWN"
    );
    private static final double MIN_CONFIDENCE = 0.8;

    public static ScanRecognition from(JsonNode value) {
        var category = text(value, "category", 32).toUpperCase(Locale.ROOT);
        var confidenceValue = value == null ? null : value.path("confidence");
        var confidence = confidenceValue != null && confidenceValue.isNumber()
            ? confidenceValue.asDouble() : 0;
        if (!CATEGORIES.contains(category) || !Double.isFinite(confidence) || confidence < 0 || confidence > 1) {
            category = "UNKNOWN";
            confidence = 0;
        }
        var displayName = text(value, "displayName", 255);
        // A low-confidence prediction must not be presented as an established identity.
        if (confidence < MIN_CONFIDENCE || displayName.isBlank()) category = "UNKNOWN";
        var allowed = "SUPPLEMENT".equals(category);
        var message = "UNKNOWN".equals(category) ? fallbackMessage(category) : text(value, "messageKo", 500);
        if (message.isBlank()) message = fallbackMessage(category);
        return new ScanRecognition(category, displayName, confidence, message, allowed);
    }

    public static ScanRecognition unknown() {
        return new ScanRecognition("UNKNOWN", "", 0, fallbackMessage("UNKNOWN"), false);
    }

    /** Discard supplement-only suggestions even if an upstream response supplies them. */
    public static void clearSupplementDetails(ObjectNode target) {
        for (var field : new String[] {"suggestedUseOriginal", "suggestedUseKo", "warningsOriginal", "warningsKo",
            "recommendedDoseTime", "servingBasisKo", "storageKo"}) target.put(field, "");
        target.putArray("ingredients");
        target.putArray("otherIngredients");
        target.remove("research");
        target.remove("productInformation");
    }

    private static String fallbackMessage(String category) {
        return switch (category) {
            case "SUPPLEMENT" -> "영양제로 확인했어요. 저장하기 전에 제품 정보와 라벨을 한 번 확인해 주세요.";
            case "ALCOHOL" -> "술로 보여요. 술은 건강에 부담을 줄 수 있으니 음주를 줄이는 쪽으로 챙겨주세요.";
            case "BEVERAGE" -> "음료로 보여요. 제품에 따라 당이나 카페인이 들어 있을 수 있으니 라벨을 확인해 주세요.";
            case "FOOD" -> "식품으로 보여요. 드시기 전에 알레르기 성분과 보관 방법을 확인해 주세요.";
            case "MEDICINE" -> "의약품으로 보여요. 영양제로 등록하기보다 처방이나 약사의 안내에 따라 복용해 주세요.";
            case "OTHER" -> "영양제와 다른 대상으로 보여요. 영양제를 등록하려면 제품명이 잘 보이게 다시 찍어주세요.";
            default -> "사진은 확인했지만 영양제인지 아직 구분하기 어려워요. 제품명과 라벨이 잘 보이게 다시 찍어주세요.";
        };
    }

    private static String text(JsonNode node, String field, int limit) {
        if (node == null || !node.path(field).isTextual()) return "";
        var value = node.path(field).asText().trim();
        return value.codePointCount(0, value.length()) <= limit ? value
            : value.substring(0, value.offsetByCodePoints(0, limit));
    }
}
