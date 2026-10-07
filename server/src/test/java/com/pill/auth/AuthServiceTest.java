package com.pill.auth;

import com.pill.repository.AuthSessionRepository;
import com.pill.repository.UserRepository;
import com.pill.model.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.Clock;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Import({AuthService.class, AuthSessionService.class, SessionTokenService.class, AuthServiceTest.ClockConfiguration.class})
class AuthServiceTest {
    @Autowired AuthService authService;
    @Autowired AuthSessionRepository sessionRepository;
    @Autowired UserRepository userRepository;

    @Test
    void signupCreatesUserAndReturnsToken() {
        var response = authService.signup("user@example.com", "pass1234");

        assertThat(response.token()).isNotBlank();
        assertThat(sessionRepository.findAll()).singleElement()
            .extracting(com.pill.model.AuthSession::getTokenHash)
            .isNotEqualTo(response.token());
        assertThat(userRepository.findByEmail("user@example.com")).isPresent();
        assertThat(userRepository.findByEmail("user@example.com").get().getPasswordHash()).doesNotContain("pass1234");
    }

    @Test
    void signupRejectsDuplicateEmail() {
        authService.signup("user@example.com", "pass1234");

        assertThatThrownBy(() -> authService.signup("user@example.com", "pass1234"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("already exists");
    }

    @Test
    void signupNormalizesDuplicateRaceFromDatabaseConstraint() {
        var repository = mock(UserRepository.class);
        when(repository.existsByEmail("race@example.com")).thenReturn(false);
        when(repository.saveAndFlush(any(User.class)))
            .thenThrow(new DataIntegrityViolationException("duplicate email"));
        var service = new AuthService(repository, mock(AuthSessionService.class), new BCryptPasswordEncoder());

        assertThatThrownBy(() -> service.signup("race@example.com", "pass1234"))
            .isInstanceOf(DuplicateEmailException.class)
            .hasMessageContaining("already exists");
    }

    @Test
    void signupRethrowsUnrelatedIntegrityViolation() {
        var repository = mock(UserRepository.class);
        var exception = new DataIntegrityViolationException("foreign key violation on supplement_scan");
        when(repository.existsByEmail("race@example.com")).thenReturn(false);
        when(repository.saveAndFlush(any(User.class))).thenThrow(exception);
        var service = new AuthService(repository, mock(AuthSessionService.class), new BCryptPasswordEncoder());

        assertThatThrownBy(() -> service.signup("race@example.com", "pass1234"))
            .isSameAs(exception);
    }

    @Test
    void loginRejectsWrongPassword() {
        authService.signup("user@example.com", "pass1234");

        assertThatThrownBy(() -> authService.login("user@example.com", "wrong"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("invalid credentials");
    }

    @Test
    void loginRunsPasswordCheckForUnknownEmail() {
        var repository = mock(UserRepository.class);
        var passwordEncoder = mock(PasswordEncoder.class);
        when(passwordEncoder.encode(any())).thenReturn("dummy-hash");
        when(repository.findByEmail("missing@example.com")).thenReturn(Optional.empty());
        var service = new AuthService(repository, mock(AuthSessionService.class), passwordEncoder);

        assertThatThrownBy(() -> service.login("missing@example.com", "candidate-password"))
            .isInstanceOf(InvalidCredentialsException.class);

        verify(passwordEncoder).matches("candidate-password", "dummy-hash");
    }

    @TestConfiguration
    static class ClockConfiguration {
        @Bean
        Clock clock() {
            return Clock.systemUTC();
        }

        @Bean
        PasswordEncoder passwordEncoder() {
            return new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
        }
    }
}
