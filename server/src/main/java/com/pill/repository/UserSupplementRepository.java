package com.pill.repository;

import com.pill.model.UserSupplement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserSupplementRepository extends JpaRepository<UserSupplement, Long> {
    boolean existsByScanId(Long scanId);

    List<UserSupplement> findTop20ByUserIdOrderByCreatedAtDesc(Long userId);

    List<UserSupplement> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<UserSupplement> findByIdAndUserId(Long id, Long userId);

    List<UserSupplement> findByUserIdAndScanIdIn(Long userId, Collection<Long> scanIds);
}
