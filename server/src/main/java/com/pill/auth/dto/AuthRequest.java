package com.pill.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.AssertTrue;
import java.nio.charset.StandardCharsets;

public record AuthRequest(
    @NotBlank @Email @Size(max = 255) String email,
    @NotBlank @Size(min = 8, max = 128) String password
) {
    @AssertTrue(message = "비밀번호는 UTF-8 기준 72바이트 이내로 입력해 주세요.")
    public boolean isPasswordWithinByteLimit() {
        return password == null || password.getBytes(StandardCharsets.UTF_8).length <= 72;
    }
}
