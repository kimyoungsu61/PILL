package com.pill.supplement;

import com.pill.gemini.GeminiClient;
import com.pill.model.*;
import com.pill.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:photo-concurrency;MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class ProductImageConcurrencyTest {
    @Autowired ProductImageService service;
    @Autowired SupplementService supplements;
    @Autowired UserRepository users;
    @Autowired SupplementScanRepository scans;
    @Autowired UserSupplementRepository products;
    @MockitoBean ProductImagePageClient pages;
    @MockitoBean GeminiClient gemini;

    @Test void simultaneousPhoneAndBrowserRequestsReuseACommittedPhotoWithoutRepeatingSearch() throws Exception {
        var user = users.save(new User("photo-concurrency@example.test", "unused"));
        var scan = scans.save(new SupplementScan(user, "{}", "COMPLETED", "{}", """
            {"research":{"status":"CANDIDATE","sources":[{"url":"https://mynanowell.com/products/hovenia-rx-milk-thistle"}]}}
            """, null));
        var product = products.save(new UserSupplement(user, scan, "nanowell", "HOVENIA-Rx MILK THISTLE", "밀크씨슬", "",
            "", "", "", "120 Tablets", "", "09:00,19:00"));
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        when(pages.read(anyString())).thenAnswer(invocation -> {
            entered.countDown();
            if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Test lookup was not released");
            return new ProductImagePageClient.Page("https://mynanowell.com/products/hovenia-rx-milk-thistle", """
                <script type="application/ld+json">{"@type":"Product","brand":{"name":"Nanowell"},
                  "name":"Hovenia-Rx Milk Thistle (120 Tablets)","image":"https://cdn.shopify.com/nanowell-product.png"}</script>
                """);
        });
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> service.resolve(user.getId(), product.getId()));
            assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
            var second = executor.submit(() -> service.resolve(user.getId(), product.getId()));
            try {
                assertThatThrownBy(() -> second.get(150, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            } finally { release.countDown(); }
            var found = first.get(10, TimeUnit.SECONDS);
            assertThat(found.status()).isEqualTo("FOUND");
            assertThat(second.get(10, TimeUnit.SECONDS)).isEqualTo(found);
            assertThat(supplements.home(user.getId()).supplements().getFirst().imageUri()).isEqualTo(found.imageUri());
            assertThat(service.resolve(user.getId(), product.getId())).isEqualTo(found);
            verify(pages, times(1)).read(anyString());
            verifyNoInteractions(gemini);
        }
    }
}
