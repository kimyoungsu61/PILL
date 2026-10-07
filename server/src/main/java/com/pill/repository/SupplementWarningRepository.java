package com.pill.repository;

import com.pill.model.SupplementWarning;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplementWarningRepository extends JpaRepository<SupplementWarning, Long> {
    void deleteBySupplementId(Long supplementId);
}
