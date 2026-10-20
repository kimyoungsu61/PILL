package com.pill.supplement;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pill.common.InMemoryRateLimiter;
import com.pill.gemini.GeminiClient;
import com.pill.model.*;
import com.pill.repository.UserSupplementRepository;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ProductImageServiceTest {
    private final ObjectMapper json = new ObjectMapper();
    private final UserSupplementRepository repository = mock(UserSupplementRepository.class);
    private final GeminiClient gemini = mock(GeminiClient.class);
    private final ProductImagePageClient pages = mock(ProductImagePageClient.class);
    private final InMemoryRateLimiter limiter = mock(InMemoryRateLimiter.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-20T02:00:00Z"), ZoneOffset.UTC);
    private final ProductImageService service = new ProductImageService(repository, gemini, pages, limiter, clock);

    private UserSupplement product(String normalized) {
        var user = new User("owner@example.test", "hash");
        var scan = new SupplementScan(user, "{}", "COMPLETED", "{\"photo\":\"original\"}", normalized, null);
        var supplement = new UserSupplement(user, scan, "Doctor's Best", "High Absorption Magnesium", "마그네슘",
            "file:///phone/front.jpg", "하루 두 번", "", "", "240 tablets", "", "09:00,19:00");
        when(repository.findByIdAndUserId(7L, 1L)).thenReturn(Optional.of(supplement));
        return supplement;
    }

    @Test void backfillsOldProductsFromStoredSourcesAndCachesWithoutAnotherAiRequest() throws Exception {
        var supplement = product("""
            {"ingredients":[{"name":"Magnesium","amount":"100"}],"research":{"status":"CANDIDATE","sources":[{"url":"https://doctorsbest.com/products/magnesium"}]},
             "productInformation":{"guidance":{"overviewKo":"기존 설명"}}}
            """);
        when(pages.read(anyString())).thenReturn(new ProductImagePageClient.Page("https://doctorsbest.com/products/magnesium", """
            <script type="application/ld+json">{"@type":"Product","name":"Doctor's Best High Absorption Magnesium 240 Tablets","image":"https://cdn.shopify.com/magnesium.jpg"}</script>
            """));
        var first = service.resolve(1L, 7L);
        assertThat(service.resolve(1L, 7L)).isEqualTo(first);
        assertThat(first.status()).isEqualTo("FOUND");
        assertThat(supplement.getImageUri()).isEqualTo("https://cdn.shopify.com/magnesium.jpg");
        var stored = json.readTree(supplement.getScan().getNormalizedAiResultJson());
        assertThat(stored.at("/ingredients/0/amount").asText()).isEqualTo("100");
        assertThat(stored.at("/productInformation/guidance/overviewKo").asText()).isEqualTo("기존 설명");
        assertThat(supplement.getConfirmedDoseTime()).isEqualTo("09:00,19:00");
        assertThat(supplement.getScan().getRawAiResponseJson()).isEqualTo("{\"photo\":\"original\"}");
        verifyNoInteractions(gemini);
        verify(pages, times(1)).read(anyString());
    }

    @Test void optionalSearchFailureDoesNotLoseTheProductAndIsNotRetriedOnEveryScreenOpen() {
        var supplement = product("{}");
        when(gemini.productImageSources(any())).thenThrow(new IllegalStateException("provider temporarily unavailable"));
        assertThat(service.resolve(1L, 7L).status()).isEqualTo("UNAVAILABLE");
        assertThat(service.resolve(1L, 7L).status()).isEqualTo("UNAVAILABLE");
        assertThat(ProductImageService.displayImage(supplement)).isEmpty();
        assertThat(supplement.getProductName()).isEqualTo("High Absorption Magnesium");
        verify(gemini, times(1)).productImageSources(any());
    }

    @Test void anotherUsersProductIsNeverLookedUpOrSentToTheProvider() {
        when(repository.findByIdAndUserId(7L, 2L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.resolve(2L, 7L)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(gemini, pages, limiter);
    }
}
