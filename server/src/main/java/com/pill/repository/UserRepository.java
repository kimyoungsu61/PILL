package com.pill.repository;

import com.pill.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select user from User user where user.id = :id")
    Optional<User> lockById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select user from User user where user.email = :email")
    Optional<User> lockByEmail(@Param("email") String email);

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);
}
