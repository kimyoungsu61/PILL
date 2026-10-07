package com.pill.scan;

import com.pill.common.ApiError;
import com.pill.gemini.GeminiResponseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.RestClientException;

@RestControllerAdvice(assignableTypes = ScanController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
class ScanExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ScanExceptionHandler.class);

    @ExceptionHandler(InvalidImageException.class)
    ResponseEntity<ApiError> handleInvalidImage() {
        return ResponseEntity.badRequest()
            .body(new ApiError("INVALID_IMAGE", "지원되는 이미지 파일을 선택해 주세요."));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException ex) {
        if ("scan not found".equals(ex.getMessage())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError("NOT_FOUND", "요청한 항목을 찾을 수 없습니다."));
        }
        if ("invalid Gemini JSON".equals(ex.getMessage())) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ApiError(
                    "PROVIDER_UNAVAILABLE",
                    "AI 분석 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
                ));
        }
        return ResponseEntity.badRequest()
            .body(new ApiError("INVALID_REQUEST", "입력값을 확인해 주세요."));
    }

    @ExceptionHandler(RestClientException.class)
    ResponseEntity<ApiError> handleGeminiClientFailure() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(new ApiError(
                "PROVIDER_UNAVAILABLE",
                "AI 분석 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
            ));
    }

    @ExceptionHandler(GeminiResponseException.class)
    ResponseEntity<ApiError> handleGeminiResponseFailure() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(new ApiError(
                "PROVIDER_UNAVAILABLE",
                "AI 분석 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
            ));
    }

    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<ApiError> handleConfigurationFailure(IllegalStateException ex) {
        if (ex.getMessage() != null && ex.getMessage().contains("GEMINI_API_KEY")) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ApiError(
                    "PROVIDER_UNAVAILABLE",
                    "AI 분석 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
                ));
        }
        log.error("Unhandled scan exception type: {}", ex.getClass().getName());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ApiError("INTERNAL_ERROR", "요청을 처리하지 못했습니다."));
    }
}
