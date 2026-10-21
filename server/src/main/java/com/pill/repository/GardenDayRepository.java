package com.pill.repository;

import com.pill.model.GardenDay;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GardenDayRepository extends JpaRepository<GardenDay, Long> {
    Optional<GardenDay> findByUserIdAndStampDate(Long userId, LocalDate date);
    List<GardenDay> findByUserIdAndEarnedTrueOrderByStampDateAsc(Long userId);
}
