package com.pill.supplement;

import java.util.List;
import java.util.Locale;

public final class SupplementDisplayName {
    private SupplementDisplayName() {
    }

    public static String choose(String productName, List<String> contextParts) {
        var fallback = text(productName).trim();
        var context = new StringBuilder(fallback);
        if (contextParts != null) {
            for (var part : contextParts) {
                append(context, part);
            }
        }

        var normalized = context.toString().toLowerCase(Locale.ROOT);
        if (containsAny(normalized, "milk thistle", "silymarin", "밀크씨슬", "실리마린")) {
            return "밀크씨슬";
        }
        if ((normalized.contains("multi") && normalized.contains("vita")) || containsAny(normalized, "multivitamin", "multi vitamin", "종합비타민")) {
            return "멀티비타민";
        }
        if (containsAny(normalized, "vitamin c", "비타민 c")) {
            return "비타민 C";
        }
        if (containsAny(normalized, "vitamin d", "비타민 d")) {
            return "비타민 D";
        }
        if (containsAny(normalized, "omega", "오메가")) {
            return "오메가3";
        }
        if (containsAny(normalized, "probiotic", "lactobacillus", "유산균", "프로바이오틱")) {
            return "유산균";
        }
        if (containsAny(normalized, "magnesium", "마그네슘")) {
            return "마그네슘";
        }
        if (containsAny(normalized, "lutein", "루테인")) {
            return "루테인";
        }
        if (containsAny(normalized, "collagen", "콜라겐")) {
            return "콜라겐";
        }
        return fallback;
    }

    private static void append(StringBuilder builder, String value) {
        if (value != null && !value.isBlank()) {
            builder.append(' ').append(value);
        }
    }

    private static boolean containsAny(String text, String... terms) {
        for (var term : terms) {
            if (text.contains(term.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private static String text(String value) {
        return value == null ? "" : value;
    }
}
