package com.pill.supplement;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pill.common.InMemoryRateLimiter;
import com.pill.gemini.GeminiClient;
import com.pill.model.UserSupplement;
import com.pill.repository.UserSupplementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;

@Service
public class ProductImageService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final UserSupplementRepository supplements;
    private final GeminiClient gemini;
    private final ProductImagePageClient pages;
    private final InMemoryRateLimiter limiter;
    private final Clock clock;

    public record Result(String status, String imageUri, String sourceUrl, String checkedAt) { }

    public ProductImageService(UserSupplementRepository supplements, GeminiClient gemini,
        ProductImagePageClient pages, InMemoryRateLimiter limiter, Clock clock) {
        this.supplements = supplements;
        this.gemini = gemini;
        this.pages = pages;
        this.limiter = limiter;
        this.clock = clock;
    }

    @Transactional
    public Result resolve(Long userId, Long supplementId) {
        var supplement = supplements.findByIdAndUserId(supplementId, userId)
            .orElseThrow(() -> new IllegalArgumentException("supplement not found"));
        var stored = stored(supplement);
        var previous = stored.path("productImage");
        if (fresh(previous)) return JSON.convertValue(previous, Result.class);
        limiter.consume("product-image-hour", userId.toString(), 30, Duration.ofHours(1));
        var identity = JSON.createObjectNode();
        identity.put("brandName", supplement.getBrandName());
        identity.put("productName", supplement.getProductName());
        identity.put("originalLabelText", supplement.getOriginalLabelText());
        Result result;
        if (identity.path("brandName").asText("").isBlank() || identity.path("productName").asText("").isBlank()) {
            result = empty("NOT_FOUND");
        } else {
            var seen = new HashSet<String>();
            result = matchedResearchImage(stored.path("research"), identity, seen);
            if (result == null) result = matchedResearchImage(stored.path("guideResearch"), identity, seen);
            if (result == null) {
                try { result = find(gemini.productImageSources(identity), identity, seen); }
                catch (RuntimeException exception) { result = empty("UNAVAILABLE"); }
            }
            if (result == null) result = empty("NOT_FOUND");
        }
        stored.set("productImage", JSON.valueToTree(result));
        supplement.getScan().updateProductInformation(stored.toString());
        if ("FOUND".equals(result.status())) supplement.updateImageUri(result.imageUri());
        return result;
    }

    private Result matchedResearchImage(JsonNode research, ObjectNode identity, HashSet<String> seen) {
        return "CANDIDATE".equals(research.path("status").asText()) ? find(research.path("sources"), identity, seen) : null;
    }

    private Result find(JsonNode sources, ObjectNode identity, HashSet<String> seen) {
        if (!sources.isArray()) return null;
        int inspected = 0;
        for (var source : sources) {
            var url = source.path("url").asText(source.path("uri").asText(""));
            if (url.isBlank() || !seen.add(url)) continue;
            if (inspected++ >= 3) break;
            var page = pages.read(url);
            var image = ProductImageMetadata.extract(page, identity.path("brandName").asText(),
                identity.path("productName").asText(), identity.path("originalLabelText").asText(""));
            if (!image.isBlank()) return new Result("FOUND", image, page.url(), clock.instant().toString());
        }
        return null;
    }

    private boolean fresh(JsonNode image) {
        try {
            if ("FOUND".equals(image.path("status").asText())) return ProductImagePageClient.imageUrl(image.path("imageUri").asText());
            var age = "UNAVAILABLE".equals(image.path("status").asText()) ? Duration.ofHours(1) : Duration.ofDays(7);
            return Instant.parse(image.path("checkedAt").asText()).plus(age).isAfter(clock.instant());
        } catch (Exception ignored) { return false; }
    }

    private Result empty(String status) { return new Result(status, "", "", clock.instant().toString()); }

    private static ObjectNode stored(UserSupplement supplement) {
        try {
            var root = JSON.readTree(supplement.getScan().getNormalizedAiResultJson());
            if (root.isTextual()) root = JSON.readTree(root.asText());
            if (root instanceof ObjectNode object) return object;
        } catch (Exception ignored) { }
        return JSON.createObjectNode();
    }

    public static String displayImage(UserSupplement supplement) {
        var image = supplement.getImageUri();
        return image != null && ProductImagePageClient.imageUrl(image) ? image : "";
    }
}
