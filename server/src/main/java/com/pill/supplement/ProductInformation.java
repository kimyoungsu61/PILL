package com.pill.supplement;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** Optional product education kept alongside the scan, separate from confirmed label facts. */
public final class ProductInformation {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private ProductInformation() { }

    public static ObjectNode fromResearch(JsonNode observed, JsonNode research) {
        var result = MAPPER.createObjectNode();
        var candidate = "CANDIDATE".equals(research.path("status").asText()) ? research.path("candidate") : MAPPER.createObjectNode();
        var others = stringList(observed.path("otherIngredients"));
        if (others.isEmpty()) others = stringList(candidate.path("otherIngredients"));
        result.set("otherIngredients", others);
        var storage = text(observed, "storageKo", 1000);
        result.put("storageKo", storage.isBlank() ? text(candidate, "storageKo", 1000) : storage);
        if (hasGuidance(research.path("guidance"))) result.set("guidance", research.path("guidance"));
        result.put("labelMatched", candidate.isObject() && !candidate.isEmpty());
        if (candidate.isObject() && !candidate.isEmpty()) {
            var label = result.putObject("referenceLabel");
            label.put("servingBasisKo", text(candidate, "servingBasisKo", 255));
            label.put("suggestedUseKo", text(candidate, "suggestedUseKo", 1000));
            label.set("ingredients", candidate.path("ingredients"));
        }
        result.put("checkedAt", research.path("checkedAt").asText(""));
        return result;
    }

    public static JsonNode fromStored(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            var root = MAPPER.readTree(json);
            if (root.isTextual()) root = MAPPER.readTree(root.asText());
            var info = root.path("productInformation");
            return info.isObject() ? info : null;
        } catch (Exception ignored) { return null; }
    }

    public static boolean hasGuidance(JsonNode info) {
        if (info == null || !info.isObject() || info.path("sources").isEmpty()) return false;
        return !text(info, "overviewKo", 1600).isBlank() || !text(info, "routineTipKo", 1600).isBlank()
            || !text(info, "cautionKo", 1600).isBlank();
    }

    public static String text(JsonNode node, String key, int limit) {
        var value = node.path(key).asText("").trim();
        return value.length() <= limit ? value : value.substring(0, limit);
    }

    public static ArrayNode stringList(JsonNode raw) {
        var result = MAPPER.createArrayNode();
        var seen = new java.util.HashSet<String>();
        if (raw.isArray()) for (var item : raw) {
            if (!item.isTextual() || result.size() >= 40) continue;
            var value = item.asText().trim();
            if (!value.isBlank() && seen.add(value)) result.add(value.substring(0, Math.min(value.length(), 255)));
        }
        return result;
    }
}
