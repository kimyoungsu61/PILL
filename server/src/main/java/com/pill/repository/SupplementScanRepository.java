package com.pill.repository;

import com.pill.model.SupplementScan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SupplementScanRepository extends JpaRepository<SupplementScan, Long> {
    Optional<SupplementScan> findByIdAndUserId(Long id, Long userId);

    List<SupplementScan> findTop100ByUserIdAndStatusNotOrderByCreatedAtDesc(Long userId, String status);
}
