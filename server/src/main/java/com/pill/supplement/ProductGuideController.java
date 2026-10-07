package com.pill.supplement;

import com.fasterxml.jackson.databind.JsonNode;
import com.pill.auth.CurrentUser;
import com.pill.gemini.GeminiResponseException;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

@RestController
@Validated
public class ProductGuideController {
    private final ProductGuideService guides;
    public ProductGuideController(ProductGuideService guides) { this.guides = guides; }

    @PostMapping("/api/supplements/{id}/guide")
    public JsonNode guide(@CurrentUser Long userId, @PathVariable @Positive Long id) {
        try {
            return guides.guide(userId, id);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "요청한 제품을 찾을 수 없습니다.");
        } catch (GeminiResponseException | RestClientException | IllegalStateException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "제품 안내를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
        }
    }
}
