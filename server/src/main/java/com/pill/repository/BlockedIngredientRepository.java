package com.pill.repository;

import com.pill.model.BlockedIngredient;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BlockedIngredientRepository extends JpaRepository<BlockedIngredient, Long> {
    Optional<BlockedIngredient> findByName(String name);
}
