package com.pill.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class SessionTokenService {
    private static final int TOKEN_BYTES = 32;

    private final SecureRandom secureRandom;

    @Autowired
    public SessionTokenService() {
        this(new SecureRandom());
    }

    SessionTokenService(SecureRandom secureRandom) {
        this.secureRandom = secureRandom;
    }

    public String issue() {
        var bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public String hash(String token) {
        if (token == null || token.isBlank()) {
            throw new InvalidSessionException();
        }
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }
}
