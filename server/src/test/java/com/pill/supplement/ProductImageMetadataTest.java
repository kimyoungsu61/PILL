package com.pill.supplement;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class ProductImageMetadataTest {
    private static final String URL = "https://www.doctorsbest.com/products/high-absorption-magnesium";

    @Test void acceptsTheExistingFullLabelNameWhenTheManufacturerHeadingUsesAShortName() {
        var url = "https://doctorsbest.com/products/doctor-s-best-high-absorption-magnesium-lysinate-glycinate-chelated-albion-traacs-120-tablets-100-mg-per-tablet-15";
        var html = """
            <script type="application/ld+json">{"@type":"Product","name":"Doctor's Best High Absorption Magnesium, 100 mg, 120 Tablets",
              "image":"https://cdn.shopify.com/real-magnesium-120.jpg"}</script>
            """;
        var page = new ProductImagePageClient.Page(url, html);
        assertThat(ProductImageMetadata.extract(page, "Doctor's Best", "High Absorption Magnesium Lysinate Glycinate 100% Chelated", "100 mg 120 Tablets"))
            .isEqualTo("https://cdn.shopify.com/real-magnesium-120.jpg");
        assertThat(ProductImageMetadata.extract(page, "Doctor's Best", "High Absorption Magnesium Lysinate Glycinate 100% Chelated", "100 mg 240 Tablets")).isEmpty();
        assertThat(ProductImageMetadata.extract(page, "Doctor's Best", "Vitamin C", "120 tablets")).isEmpty();
        assertThat(ProductImageMetadata.extract(new ProductImagePageClient.Page(url, html.replace("120 Tablets", "240 Tablets")),
            "Doctor's Best", "High Absorption Magnesium Lysinate Glycinate 100% Chelated", "100 mg 120 Tablets")).isEmpty();
    }

    @Test void readsActualProductImageFromJsonLdRatherThanTheOrganizationLogoOrRelatedProduct() {
        var html = """
            <script type="application/ld+json">{"@graph":[
              {"@type":"Organization","logo":"https://cdn.shopify.com/logo.png"},
              {"@type":"Product","name":"Doctor's Best Vitamin D","image":"https://cdn.shopify.com/vitamin-d.jpg"},
              {"@type":"Product","brand":{"name":"Doctor’s Best"},"name":"High Absorption Magnesium 100 mg 240 Tablets",
                "image":[{"@type":"ImageObject","contentUrl":"https://cdn.shopify.com/magnesium.jpg"}]}]}</script>
            """;
        assertThat(ProductImageMetadata.extract(new ProductImagePageClient.Page(URL, html), "Doctor's Best", "High Absorption Magnesium", "240 tablets"))
            .isEqualTo("https://cdn.shopify.com/magnesium.jpg");
        assertThat(ProductImageMetadata.extract(new ProductImagePageClient.Page(URL, html), "Doctor's Best", "High Absorption Magnesium", "120 tablets")).isEmpty();
    }

    @Test void readsOpenGraphAttributesRegardlessOfOrderAndPreservesImageQueryParameters() {
        var html = """
            <meta content='Doctor&#39;s Best High Absorption Magnesium' property='og:title'>
            <meta content='//cdn.shopify.com/magnesium.jpg?width=400&amp;v=2' property='og:image'>
            """;
        assertThat(ProductImageMetadata.extract(new ProductImagePageClient.Page(URL, html), "닥터스베스트", "High Absorption Magnesium"))
            .isEqualTo("https://cdn.shopify.com/magnesium.jpg?width=400&v=2");
    }

    @Test void rejectsWrongBrandStrengthChemicalFormAndCollectionPages() {
        assertThat(ProductImageMetadata.matches("NOW Milk Thistle 150 mg", "NOW Foods", "Milk Thistle 150mg")).isTrue();
        assertThat(ProductImageMetadata.matches("Other Brand Magnesium Citrate 400 mg", "Doctor's Best", "Magnesium Citrate 400 mg")).isFalse();
        assertThat(ProductImageMetadata.matches("Doctor's Best Magnesium Citrate 200 mg", "Doctor's Best", "Magnesium Citrate 400 mg")).isFalse();
        assertThat(ProductImageMetadata.matches("Doctor's Best Magnesium Oxide 400 mg", "Doctor's Best", "Magnesium Citrate 400 mg")).isFalse();
        var html = "<meta property='og:title' content='Doctor’s Best High Absorption Magnesium'><meta property='og:image' content='https://cdn.shopify.com/magnesium.jpg'>";
        assertThat(ProductImageMetadata.extract(new ProductImagePageClient.Page("https://doctorsbest.com/collections/magnesium", html), "Doctor's Best", "High Absorption Magnesium")).isEmpty();
    }

    @Test void rejectsUnsafeImagesAndPublisherLookalikeHosts() {
        for (var url : new String[]{"http://cdn.shopify.com/a.jpg", "https://127.0.0.1/a.jpg", "file:///phone/front.jpg",
            "https://cdn.shopify.com.evil.test/a.jpg", "https://user:password@cdn.shopify.com/a.jpg", "https://cdn.shopify.com/logo.png"}) {
            assertThat(ProductImagePageClient.imageUrl(url)).as(url).isFalse();
        }
        assertThat(ProductImagePageClient.publisher("doctorsbest.com.evil.test")).isFalse();
        assertThat(new ProductImagePageClient().read("http://127.0.0.1/private")).isNull();
        assertThat(new ProductImagePageClient().read("https://unknown.example/product")).isNull();
    }
}
