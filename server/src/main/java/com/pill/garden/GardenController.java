package com.pill.garden;

import com.pill.auth.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/garden")
public class GardenController {
    private final GardenService garden;
    public GardenController(GardenService garden) { this.garden = garden; }
    public record StyleRequest(@NotBlank @Size(max = 20) String pot, @NotBlank @Size(max = 20) String stamp) {}
    @GetMapping
    public GardenService.State state(@CurrentUser Long userId) { return garden.state(userId); }
    @PutMapping("/style")
    public GardenService.State style(@CurrentUser Long userId, @Valid @RequestBody StyleRequest request) {
        return garden.selectStyle(userId, request.pot(), request.stamp());
    }
}
