package com.pill.account;

import com.pill.auth.SessionPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AccountDeletionController {
    private final AccountDeletionService deletion;

    public AccountDeletionController(AccountDeletionService deletion) {
        this.deletion = deletion;
    }

    public record DeleteRequest(@NotBlank @Size(max = 128) String password,
        @NotBlank @Pattern(regexp = "탈퇴") String confirmation) {}

    @DeleteMapping("/api/account")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal SessionPrincipal principal,
        @Valid @RequestBody DeleteRequest request) {
        deletion.delete(principal.userId(), principal.sessionId(), request.password(), request.confirmation());
        // Do not expire the browser cookie here: a delayed response for this
        // account must not overwrite a newer account's cookie. Removed sessions
        // cannot authenticate, and the client clears its own signed-in state.
    }
}
