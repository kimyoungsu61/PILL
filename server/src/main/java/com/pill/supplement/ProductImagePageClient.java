package com.pill.supplement;

import org.springframework.stereotype.Component;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Set;

/** Bounded, credential-free reads of public product pages. No arbitrary URL proxy. */
@Component
public class ProductImagePageClient {
    private static final Set<String> PUBLISHERS = Set.of(
        "doctorsbest.com", "drbvitamins.com", "nowfoods.com", "solgar.com", "thorne.com",
        "lifeextension.com", "jarrow.com", "jarrowformulas.com", "naturesway.com", "naturemade.com",
        "naturesbounty.com", "nordic.com", "nordicnaturals.com", "sportsresearch.com", "natrol.com",
        "gardenoflife.com", "pureencapsulationspro.com", "pureencapsulations.com", "gnc.com",
        "iherb.com", "vitacost.com", "swansonvitamins.com", "cgnvitamins.com", "kirklandvitamins.com",
        "mynanowell.com", "nanowellhealth.com");
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3))
        .followRedirects(HttpClient.Redirect.NEVER).build();

    public record Page(String url, String html) { }

    public Page read(String url) {
        try {
            var uri = URI.create(url);
            for (int redirect = 0; redirect < 4; redirect++) {
                boolean google = "vertexaisearch.cloud.google.com".equals(uri.getHost())
                    && uri.getPath().startsWith("/grounding-api-redirect/");
                if (!https(uri) || (!google && !publisher(uri.getHost()))) return null;
                var response = client.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(5))
                    .header("User-Agent", "PILL/1.0 Product image lookup")
                    .header("Accept", "text/html").GET().build(), HttpResponse.BodyHandlers.ofInputStream());
                try (var input = response.body()) {
                    if (response.statusCode() >= 300 && response.statusCode() < 400) {
                        var location = response.headers().firstValue("location").orElse("");
                        if (location.isBlank()) return null;
                        uri = uri.resolve(location);
                        continue;
                    }
                    if (google || response.statusCode() != 200
                        || !response.headers().firstValue("content-type").orElse("").contains("text/html")) return null;
                    var bytes = input.readNBytes(1_500_001);
                    if (bytes.length > 1_500_000) return null;
                    return new Page(uri.toString(), new String(bytes, StandardCharsets.UTF_8));
                }
            }
        } catch (InterruptedException exception) { Thread.currentThread().interrupt(); }
        catch (Exception ignored) { }
        return null;
    }

    static boolean publisher(String host) {
        return PUBLISHERS.stream().anyMatch(domain -> host != null
            && (host.equalsIgnoreCase(domain) || host.toLowerCase(java.util.Locale.ROOT).endsWith("." + domain)));
    }

    static boolean https(URI uri) {
        return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null
            && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    public static boolean imageUrl(String url) {
        try {
            var uri = URI.create(url);
            var host = uri.getHost();
            return https(uri) && (publisher(host) || Set.of("cdn.shopify.com", "images.ctfassets.net",
                "res.cloudinary.com", "images.prismic.io", "m.media-amazon.com", "cdn.imweb.me").contains(host))
                && !uri.getPath().toLowerCase(java.util.Locale.ROOT).matches(".*(logo|banner|favicon|placeholder|supplement.facts).*" );
        } catch (Exception ignored) { return false; }
    }
}
