package com.pill.supplement;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pill.gemini.GeminiClient;
import com.pill.gemini.GeminiResponseException;
import com.pill.model.SupplementScan;
import com.pill.model.User;
import com.pill.model.UserSupplement;
import com.pill.model.UserSupplementIngredient;
import com.pill.repository.UserSupplementRepository;
import com.pill.scan.ScanRateLimiter;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProductGuideServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final UserSupplementRepository repository = mock(UserSupplementRepository.class);
    private final GeminiClient gemini = mock(GeminiClient.class);
    private final ScanRateLimiter limiter = mock(ScanRateLimiter.class);
    private final ProductGuideService service = new ProductGuideService(repository, gemini, limiter, mapper);

    private UserSupplement product(String status) {
        var user = new User("guide-test@example.com", "hash");
        var scan = new SupplementScan(user, "{}", status, "{\"original\":\"unchanged\"}",
            "{\"brandName\":\"Photo brand\",\"ingredients\":[{\"amount\":\"100\"}]}", null);
        var supplement = new UserSupplement(user, scan, "Example", "Magnesium", "마그네슘", "", "라벨의 복용법", "", "", "100 mg 120 tablets", "", "09:00,19:00");
        supplement.updateServingBasisKo("1정당");
        supplement.addIngredient(new UserSupplementIngredient("Mg", "100", "mg", "photo", 0.9, false));
        return supplement;
    }

    @Test void storesAndCachesEducationWhileKeepingRawLabelConfirmedAmountsAndSchedule() throws Exception {
        var supplement = product("COMPLETED");
        when(repository.findByIdAndUserId(7L, 1L)).thenReturn(Optional.of(supplement));
        when(gemini.researchProduct(any())).thenReturn((com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree("""
            {"status":"CANDIDATE","checkedAt":"2026-10-07","candidate":{"brandName":"Example","productName":"Magnesium","servingBasisKo":"2정당","ingredients":[{"name":"Mg","amount":"200","unit":"mg"}]},
             "guidance":{"overviewKo":"마그네슘을 보충하는 제품이에요.","routineTipKo":"식사 시간에 맞춰 기억해 보세요.","sources":[{"title":"Product","url":"https://example.org/product"}]}}
            """));
        var first = service.guide(1L, 7L);
        var second = service.guide(1L, 7L);
        assertThat(second).isEqualTo(first);
        assertThat(ProductInformation.fromStored(supplement.getScan().getNormalizedAiResultJson())).isEqualTo(first);
        assertThat(supplement.getScan().getRawAiResponseJson()).isEqualTo("{\"original\":\"unchanged\"}");
        assertThat(supplement.getIngredients().getFirst().getAmount()).isEqualTo("100");
        assertThat(supplement.getServingBasisKo()).isEqualTo("1정당");
        assertThat(supplement.getConfirmedDoseTime()).isEqualTo("09:00,19:00");
        assertThat(mapper.readTree(supplement.getScan().getNormalizedAiResultJson()).at("/ingredients/0/amount").asText()).isEqualTo("100");
        verify(gemini, times(1)).researchProduct(any());
        verify(limiter, times(1)).consume(1L);
    }

    @Test void unsupportedGuideLeavesStoredScanUntouchedAndCanBeRetried() {
        var supplement = product("MANUAL");
        var before = supplement.getScan().getNormalizedAiResultJson();
        when(repository.findByIdAndUserId(7L, 1L)).thenReturn(Optional.of(supplement));
        when(gemini.researchProduct(any())).thenReturn(mapper.createObjectNode().put("status", "NO_SOURCES"));
        assertThatThrownBy(() -> service.guide(1L, 7L)).isInstanceOf(GeminiResponseException.class);
        assertThat(supplement.getScan().getNormalizedAiResultJson()).isEqualTo(before);
        assertThat(supplement.getScan().getStatus()).isEqualTo("MANUAL");
    }

    @Test void anotherUsersProductCannotBeReadOrSentToProvider() {
        when(repository.findByIdAndUserId(7L, 2L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.guide(2L, 7L)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(gemini, limiter);
    }
}
