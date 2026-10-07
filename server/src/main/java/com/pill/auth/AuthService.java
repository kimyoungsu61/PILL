package com.pill.auth;

import com.pill.auth.dto.AuthResponse;
import com.pill.model.User;
import com.pill.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final AuthSessionService sessions;
    private final PasswordEncoder passwordEncoder;
    private final String dummyPasswordHash;

    public AuthService(
        UserRepository userRepository,
        AuthSessionService sessions,
        PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.dummyPasswordHash = passwordEncoder.encode("not-a-real-user-password");
    }

    @Transactional
    public AuthResponse signup(String email, String password) {
        email = normalizeEmail(email);
        if (userRepository.existsByEmail(email)) {
            throw new DuplicateEmailException("user already exists");
        }

        User user;
        try {
            user = userRepository.saveAndFlush(new User(email, passwordEncoder.encode(password)));
        } catch (DataIntegrityViolationException ex) {
            if (isEmailUniqueViolation(ex)) {
                throw new DuplicateEmailException("user already exists", ex);
            }
            throw ex;
        }

        return new AuthResponse(sessions.issue(user).token(), user.getEmail());
    }

    @Transactional
    public AuthResponse login(String email, String password) {
        email = normalizeEmail(email);
        var user = userRepository.findByEmail(email).orElse(null);
        var passwordHash = user == null ? dummyPasswordHash : user.getPasswordHash();
        var passwordMatches = passwordEncoder.matches(password, passwordHash);

        if (user == null || !passwordMatches) {
            throw new InvalidCredentialsException("invalid credentials");
        }

        return new AuthResponse(sessions.issue(user).token(), user.getEmail());
    }

    @Transactional
    public void logout(Long sessionId) {
        sessions.revoke(sessionId);
    }

    @Transactional(readOnly = true)
    public String email(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(InvalidSessionException::new)
            .getEmail();
    }

    static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private boolean isEmailUniqueViolation(DataIntegrityViolationException ex) {
        var text = collectExceptionText(ex).toLowerCase();
        var mentionsEmail = text.contains("email");
        var mentionsUsers = text.contains("users") || text.contains("user");
        var mentionsUnique = text.contains("unique") || text.contains("duplicate") || text.contains("uk");

        return mentionsEmail && (mentionsUsers || mentionsUnique) && mentionsUnique;
    }

    private String collectExceptionText(Throwable throwable) {
        var builder = new StringBuilder();
        var current = throwable;
        while (current != null) {
            if (current.getMessage() != null) {
                builder.append(' ').append(current.getMessage());
            }
            current = current.getCause();
        }
        return builder.toString();
    }
}
