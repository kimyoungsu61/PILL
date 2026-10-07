package com.pill.supplement;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pill.gemini.GeminiClient;
import com.pill.gemini.GeminiResponseException;
import com.pill.repository.UserSupplementRepository;
import com.pill.scan.ScanRateLimiter;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductGuideService {
    private final UserSupplementRepository supplements;
    private final GeminiClient gemini;
    private final ScanRateLimiter limiter;
    private final ObjectMapper mapper;

    public ProductGuideService(UserSupplementRepository supplements, GeminiClient gemini,
        ScanRateLimiter limiter, ObjectMapper mapper) {
        this.supplements = supplements;
        this.gemini = gemini;
        this.limiter = limiter;
        this.mapper = mapper;
    }

    @Transactional
    public JsonNode guide(Long userId, Long supplementId) {
        var supplement = supplements.findByIdAndUserId(supplementId, userId)
            .orElseThrow(() -> new IllegalArgumentException("supplement not found"));
        var scan = supplement.getScan();
        var cached = ProductInformation.fromStored(scan.getNormalizedAiResultJson());
        if (cached != null && ProductInformation.hasGuidance(cached.path("guidance"))) return cached;
        limiter.consume(userId);
        var identity = mapper.createObjectNode();
        identity.put("brandName", supplement.getBrandName());
        identity.put("productName", supplement.getProductName());
        identity.put("originalLabelText", supplement.getOriginalLabelText());
        identity.put("servingBasisKo", supplement.getServingBasisKo());
        var research = gemini.researchProduct(identity);
        var info = ProductInformation.fromResearch(identity, research);
        if (!ProductInformation.hasGuidance(info.path("guidance"))) {
            throw new GeminiResponseException("No supported product guidance");
        }
        try {
            // Keep raw vision response, confirmed amounts and dose schedule intact.
            var json = scan.getNormalizedAiResultJson();
            var stored = json == null || json.isBlank() ? mapper.createObjectNode() : mapper.readTree(json);
            if (stored.isTextual()) stored = mapper.readTree(stored.asText());
            if (!(stored instanceof ObjectNode normalized)) throw new GeminiResponseException("Invalid stored scan");
            normalized.set("productInformation", info);
            normalized.set("guideResearch", research);
            scan.updateProductInformation(normalized.toString());
            return info;
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
            throw new GeminiResponseException("Invalid stored scan", exception);
        }
    }
}
