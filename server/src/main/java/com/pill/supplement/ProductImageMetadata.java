package com.pill.supplement;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;

/** Images must exist in publisher metadata for the matching product, never in AI-authored URLs. */
public final class ProductImageMetadata {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern SCRIPT = Pattern.compile("(?is)<script\\b([^>]*)>(.*?)</script\\s*>");
    private static final Pattern META = Pattern.compile("(?is)<meta\\b[^>]*>");
    private static final Pattern ATTRIBUTE = Pattern.compile("([\\w:-]+)\\s*=\\s*([\"'])(.*?)\\2", Pattern.DOTALL);
    private static final Set<String> OMIT = Set.of("s", "the", "and", "with", "for", "of", "dietary", "supplement", "supplements");
    private ProductImageMetadata() { }

    public static String extract(ProductImagePageClient.Page page, String brand, String product) {
        return extract(page, brand, product, "");
    }

    public static String extract(ProductImagePageClient.Page page, String brand, String product, String label) {
        if (page == null || !ProductImagePageClient.publisher(URI.create(page.url()).getHost())) return "";
        var packageCount = Pattern.compile("(?i)\\b(\\d{2,3})\\s*(?:veg(?:etable)?\\s*)?(?:tablets?|capsules?|softgels?)\\b").matcher(label);
        if (packageCount.find()) product = product + " " + packageCount.group(1);
        var scripts = SCRIPT.matcher(page.html());
        while (scripts.find()) {
            if (!"application/ld+json".equalsIgnoreCase(attributes(scripts.group(1)).get("type"))) continue;
            try {
                var image = productImage(JSON.readTree(scripts.group(2)), page.url(), brand, product, 0);
                if (!image.isBlank()) return image;
            } catch (Exception ignored) { }
        }
        var metadata = new HashMap<String, String>();
        var metas = META.matcher(page.html());
        while (metas.find()) {
            var attributes = attributes(metas.group());
            var property = attributes.getOrDefault("property", attributes.getOrDefault("name", ""));
            metadata.putIfAbsent(property.toLowerCase(Locale.ROOT), attributes.getOrDefault("content", ""));
        }
        var uri = URI.create(page.url());
        boolean productPage = metadata.getOrDefault("og:type", "").contains("product")
            || uri.getPath().matches("(?i).*/(products?|pr|p)/.+");
        if (productPage && matches(metadata.getOrDefault("og:title", ""), brand, product)) {
            return resolveImage(page.url(), metadata.getOrDefault("og:image:secure_url", metadata.getOrDefault("og:image", "")));
        }
        return "";
    }

    private static String productImage(JsonNode node, String url, String brand, String product, int depth) {
        if (node == null || depth > 8) return "";
        if (node.isObject()) {
            var type = node.path("@type");
            boolean isProduct = "Product".equals(type.asText()) || (type.isArray() && type.toString().contains("\"Product\""));
            var maker = node.path("brand").isTextual() ? node.path("brand").asText() : node.path("brand").path("name").asText("");
            if (isProduct && matches(maker + " " + node.path("name").asText(""), brand, product)) {
                var images = node.path("image");
                if (images.isArray()) for (var image : images) {
                    var candidate = resolveImage(url, imageText(image));
                    if (!candidate.isBlank()) return candidate;
                }
                else return resolveImage(url, imageText(images));
            }
            // Do not take a recommended/related product's image from the same page.
            if (node.has("@graph")) return productImage(node.path("@graph"), url, brand, product, depth + 1);
            if (node.has("mainEntity")) return productImage(node.path("mainEntity"), url, brand, product, depth + 1);
        } else if (node.isArray()) {
            for (var item : node) {
                var candidate = productImage(item, url, brand, product, depth + 1);
                if (!candidate.isBlank()) return candidate;
            }
        }
        return "";
    }

    private static String imageText(JsonNode node) {
        return node.isTextual() ? node.asText() : node.path("contentUrl").asText(node.path("url").asText(""));
    }

    private static String resolveImage(String page, String value) {
        try {
            if (value.isBlank()) return "";
            var url = URI.create(page).resolve(decode(value)).toString();
            return url.length() <= 2048 && ProductImagePageClient.imageUrl(url) ? url : "";
        } catch (Exception ignored) { return ""; }
    }

    static boolean matches(String title, String brand, String product) {
        var normalizedTitle = normalize(title);
        var normalizedBrand = normalize(brand);
        normalizedBrand = switch (normalizedBrand.replace(" ", "")) {
            case "닥터스베스트" -> "doctors best";
            case "nowfoods", "나우", "나우푸드", "나우푸즈" -> "now";
            case "솔가" -> "solgar";
            default -> normalizedBrand;
        };
        if (normalizedBrand.isBlank() || product == null || product.isBlank()
            || !normalizedTitle.replace(" ", "").contains(normalizedBrand.replace(" ", ""))) return false;
        var terms = Arrays.stream(normalize(product).split(" ")).filter(term -> !term.isBlank() && !OMIT.contains(term)).distinct().toList();
        if (terms.isEmpty()) return false;
        var words = new HashSet<>(Arrays.asList(normalizedTitle.split(" ")));
        // Strength/count/form words present in the identified name must never be silently discarded.
        if (terms.stream().filter(term -> term.matches(".*[0-9].*") || Set.of("citrate", "glycinate", "oxide", "malate", "threonate").contains(term))
            .anyMatch(term -> !words.contains(term))) return false;
        return terms.stream().filter(words::contains).count() == terms.size();
    }

    private static String normalize(String value) {
        return Normalizer.normalize(value == null ? "" : decode(value), Normalizer.Form.NFKC)
            .toLowerCase(Locale.ROOT).replaceAll("['’]", "")
            .replaceAll("(?<=\\p{N})(?=\\p{L})|(?<=\\p{L})(?=\\p{N})", " ")
            .replaceAll("[^\\p{L}\\p{N}]+", " ").trim().replaceAll("\\s+", " ");
    }

    private static Map<String, String> attributes(String value) {
        var result = new HashMap<String, String>();
        var matcher = ATTRIBUTE.matcher(value);
        while (matcher.find()) result.put(matcher.group(1).toLowerCase(Locale.ROOT), decode(matcher.group(3)));
        return result;
    }

    private static String decode(String value) {
        return value.replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'").replace("&apos;", "'").replace("&nbsp;", " ");
    }
}
