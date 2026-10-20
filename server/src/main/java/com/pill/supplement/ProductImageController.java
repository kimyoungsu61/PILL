package com.pill.supplement;

import com.pill.auth.CurrentUser;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@Validated
public class ProductImageController {
    private final ProductImageService images;
    public ProductImageController(ProductImageService images) { this.images = images; }

    @PostMapping("/api/supplements/{id}/product-image")
    public ProductImageService.Result image(@CurrentUser Long userId, @PathVariable @Positive Long id) {
        try { return images.resolve(userId, id); }
        catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "요청한 제품을 찾을 수 없습니다.");
        }
    }
}
