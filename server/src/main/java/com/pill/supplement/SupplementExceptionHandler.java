package com.pill.supplement;

import com.pill.common.ApiError;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = SupplementController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
class SupplementExceptionHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException ex) {
        if ("supplement not found".equals(ex.getMessage())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError("NOT_FOUND", "요청한 항목을 찾을 수 없습니다."));
        }
        return ResponseEntity.badRequest()
            .body(new ApiError("INVALID_REQUEST", "입력값을 확인해 주세요."));
    }
}
