package com.pill.auth;

import org.junit.jupiter.api.Test;

import java.security.SecureRandom;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SessionTokenServiceTest {
    private final SessionTokenService tokens = new SessionTokenService(new SecureRandom());

    @Test
    void issuesIndependent256BitTokens() {
        var first = tokens.issue();
        var second = tokens.issue();

        assertThat(Base64.getUrlDecoder().decode(first)).hasSize(32);
        assertThat(Base64.getUrlDecoder().decode(second)).hasSize(32);
        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void hashesTokensWithoutRetainingPlaintext() {
        var token = tokens.issue();

        assertThat(tokens.hash(token))
            .hasSize(64)
            .matches("[0-9a-f]{64}")
            .doesNotContain(token);
        assertThat(tokens.hash(token)).isEqualTo(tokens.hash(token));
    }

    @Test
    void rejectsMissingTokens() {
        assertThatThrownBy(() -> tokens.hash(null)).isInstanceOf(InvalidSessionException.class);
        assertThatThrownBy(() -> tokens.hash(" ")).isInstanceOf(InvalidSessionException.class);
    }
}
