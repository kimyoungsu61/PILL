package com.pill.account;

import com.pill.auth.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
public class EmailAccountController {
    private final AccountEmailService accounts;
    public EmailAccountController(AccountEmailService accounts) { this.accounts = accounts; }
    public record Code(@NotBlank @Pattern(regexp="[0-9]{6}") String code) {}
    public record EmailAddress(@NotBlank @Email @Size(max=255) String email) {}
    public record Reset(@NotBlank @Email @Size(max=255) String email,
        @NotBlank @Pattern(regexp="[0-9]{6}") String code, @NotBlank @Size(min=8,max=72) String newPassword) {}

    @GetMapping("/api/auth/account-config")
    public Map<String,Boolean> config() { return Map.of("mailAvailable", accounts.mailAvailable()); }
    @GetMapping("/api/account/profile")
    public AccountEmailService.Profile profile(@CurrentUser Long userId) { return accounts.profile(userId); }
    @PostMapping("/api/account/email-verification/request") @ResponseStatus(HttpStatus.ACCEPTED)
    public AccountEmailService.Requested requestVerification(@CurrentUser Long userId, HttpServletRequest request) {
        return accounts.requestVerification(userId, request.getRemoteAddr());
    }
    @PostMapping("/api/account/email-verification/confirm")
    public AccountEmailService.Profile confirmVerification(@CurrentUser Long userId, @Valid @RequestBody Code body, HttpServletRequest request) {
        return accounts.confirmVerification(userId, body.code(), request.getRemoteAddr());
    }
    @PostMapping("/api/auth/password-reset/request") @ResponseStatus(HttpStatus.ACCEPTED)
    public AccountEmailService.Requested requestReset(@Valid @RequestBody EmailAddress body, HttpServletRequest request) {
        return accounts.requestReset(body.email(), request.getRemoteAddr());
    }
    @PostMapping("/api/auth/password-reset/confirm") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirmReset(@Valid @RequestBody Reset body, HttpServletRequest request) {
        accounts.confirmReset(body.email(), body.code(), body.newPassword(), request.getRemoteAddr());
    }
}
