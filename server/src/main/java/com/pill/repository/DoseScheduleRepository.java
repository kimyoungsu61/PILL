package com.pill.repository;

import com.pill.model.DoseSchedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DoseScheduleRepository extends JpaRepository<DoseSchedule, Long> {
    List<DoseSchedule> findBySupplementIdOrderByConfirmedTimeAsc(Long supplementId);

    void deleteBySupplementId(Long supplementId);
}
