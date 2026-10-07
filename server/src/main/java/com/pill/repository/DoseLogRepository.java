package com.pill.repository;

import com.pill.model.DoseLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DoseLogRepository extends JpaRepository<DoseLog, Long> {
    List<DoseLog> findTop30BySupplementIdOrderByDoseDateDesc(Long supplementId);

    Optional<DoseLog> findBySupplementIdAndDoseDateAndDoseTime(Long supplementId, LocalDate doseDate, String doseTime);

    List<DoseLog> findBySupplementIdAndDoseDate(Long supplementId, LocalDate doseDate);

    @Query("""
        select log
        from DoseLog log
        join fetch log.supplement supplement
        where supplement.user.id = :userId
          and log.doseDate between :from and :to
        order by log.doseDate desc, log.doseTime asc, log.checkedAt desc
        """)
    List<DoseLog> findHistoryByUserIdAndDoseDateBetween(
        @Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to
    );

    void deleteBySupplementId(Long supplementId);
}
