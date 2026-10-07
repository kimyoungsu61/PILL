package com.pill.scan;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pill.gemini.GeminiClient;
import com.pill.model.DoseSchedule;
import com.pill.model.SupplementScan;
import com.pill.model.UserSupplement;
import com.pill.model.UserSupplementIngredient;
import com.pill.repository.DoseScheduleRepository;
import com.pill.repository.SupplementScanRepository;
import com.pill.repository.UserRepository;
import com.pill.repository.UserSupplementRepository;
import com.pill.scan.ImageUploadValidator.ValidatedImage;
import com.pill.scan.dto.ConfirmScanRequest;
import com.pill.scan.dto.ScanHistoryResponse;
import com.pill.scan.dto.ScanResultResponse;
import com.pill.supplement.SupplementDisplayName;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

@Service
public class ScanService {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final double REVIEW_CONFIDENCE_THRESHOLD = 0.8;
    private static final int MAX_PROVIDER_CHARACTERS = 250_000;
    private static final int MAX_INGREDIENTS = 100;
    private static final Pattern CLOCK_TIME_PATTERN = Pattern.compile("^(?:[01]\\d|2[0-3]):[0-5]\\d$");

    private final GeminiClient gemini;
    private final UserRepository users;
    private final SupplementScanRepository scans;
    private final UserSupplementRepository supplements;
    private final DoseScheduleRepository doseSchedules;

    public ScanService(
        GeminiClient gemini,
        UserRepository users,
        SupplementScanRepository scans,
        UserSupplementRepository supplements,
        DoseScheduleRepository doseSchedules
    ) {
        this.gemini = gemini;
        this.users = users;
        this.scans = scans;
        this.supplements = supplements;
        this.doseSchedules = doseSchedules;
    }

    @Transactional
    public ScanResultResponse analyze(Long userId, ValidatedImage frontImage, ValidatedImage backImage) {
        if (frontImage == null) {
            throw new InvalidImageException("front image is required");
        }
        var user = users.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("user not found"));
        var scan = scans.save(new SupplementScan(user, imageMetadata(frontImage, backImage), "PROCESSING"));

        try {
            var rawJson = gemini.analyzeLabel(
                frontImage.bytes(),
                frontImage.contentType(),
                backImage == null ? null : backImage.bytes(),
                backImage == null ? null : backImage.contentType()
            );
            var normalized = normalize(rawJson);
            var normalizedJson = normalizedJson(normalized);
            scan.complete(rawGeminiTextJson(rawJson), normalizedJson);
            scans.save(scan);
            return toResponse(scan.getId(), scan.getStatus(), normalized);
        } catch (RuntimeException ex) {
            scan.fail("analysis failed");
            scans.save(scan);
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public ScanResultResponse get(Long userId, Long scanId) {
        var scan = findUserScan(userId, scanId);
        if (scan.getNormalizedAiResultJson() == null || scan.getNormalizedAiResultJson().isBlank()) {
            return toResponse(scan.getId(), scan.getStatus(), emptyScan());
        }
        return toResponse(scan.getId(), scan.getStatus(), normalize(scan.getNormalizedAiResultJson()));
    }

    @Transactional(readOnly = true)
    public ScanHistoryResponse history(Long userId) {
        var userScans = scans.findTop100ByUserIdAndStatusNotOrderByCreatedAtDesc(userId, "MANUAL");
        if (userScans.isEmpty()) {
            return new ScanHistoryResponse(
                new ScanHistoryResponse.Summary(0, 0, 0, 0),
                List.of()
            );
        }

        var scanIds = userScans.stream().map(SupplementScan::getId).toList();
        Map<Long, UserSupplement> linkedSupplements = new HashMap<>();
        for (var supplement : supplements.findByUserIdAndScanIdIn(userId, scanIds)) {
            linkedSupplements.putIfAbsent(supplement.getScan().getId(), supplement);
        }

        var entries = userScans.stream()
            .map(scan -> historyEntry(scan, linkedSupplements.get(scan.getId())))
            .toList();
        var saved = (int) entries.stream().filter(ScanHistoryResponse.Entry::saved).count();
        var failed = (int) entries.stream().filter(entry -> "FAILED".equals(entry.status())).count();
        var needsReview = (int) entries.stream()
            .filter(entry -> "COMPLETED".equals(entry.status()) && !entry.saved())
            .count();

        return new ScanHistoryResponse(
            new ScanHistoryResponse.Summary(entries.size(), saved, needsReview, failed),
            entries
        );
    }

    private ScanHistoryResponse.Entry historyEntry(SupplementScan scan, UserSupplement supplement) {
        var normalized = normalizedForHistory(scan);
        var ingredientContext = normalized.ingredients().stream()
            .flatMap(ingredient -> List.of(ingredient.name(), ingredient.originalText()).stream())
            .filter(Objects::nonNull)
            .toList();
        var displayName = supplement == null
            ? SupplementDisplayName.choose(normalized.productName(), ingredientContext)
            : text(supplement.getDisplayNameKo());
        var reviewIngredientCount = (int) normalized.ingredients().stream()
            .filter(IngredientResult::needsReview)
            .count();

        return new ScanHistoryResponse.Entry(
            scan.getId(),
            scan.getStatus(),
            supplement == null ? normalized.brandName() : text(supplement.getBrandName()),
            supplement == null ? normalized.productName() : text(supplement.getProductName()),
            displayName,
            supplement == null ? "" : text(supplement.getImageUri()),
            supplement != null,
            supplement == null ? null : supplement.getId(),
            normalized.ingredients().size(),
            reviewIngredientCount,
            !text(normalized.warningsKo()).isBlank() || !text(normalized.warningsOriginal()).isBlank(),
            scan.getCreatedAt()
        );
    }

    private NormalizedScan normalizedForHistory(SupplementScan scan) {
        if (scan.getNormalizedAiResultJson() == null || scan.getNormalizedAiResultJson().isBlank()) {
            return emptyScan();
        }
        try {
            return normalize(scan.getNormalizedAiResultJson());
        } catch (IllegalArgumentException ignored) {
            return emptyScan();
        }
    }

    @Transactional
    public Long confirm(Long userId, Long scanId, ConfirmScanRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("confirmation is required");
        }
        var scan = findUserScan(userId, scanId);
        var doseTimes = doseTimes(request);
        var supplement = new UserSupplement(
            scan.getUser(),
            scan,
            text(request.brandName()),
            text(request.productName()),
            displayNameKo(request),
            text(request.imageUri()),
            text(request.suggestedUseKo()),
            text(request.suggestedUseOriginal()),
            text(request.summaryKo()),
            text(request.originalLabelText()),
            text(request.warningSummary()),
            String.join(",", doseTimes)
        );

        supplement.updateServingBasisKo(text(request.servingBasisKo()));
        for (var ingredient : safeIngredients(request)) {
            supplement.addIngredient(new UserSupplementIngredient(
                text(ingredient.name()),
                text(ingredient.amount()),
                text(ingredient.unit()),
                text(ingredient.originalText()),
                ingredient.confidence(),
                ingredient.needsReview()
            ));
        }
        var savedSupplement = supplements.save(supplement);
        for (var doseTime : doseTimes) {
            doseSchedules.save(new DoseSchedule(savedSupplement, doseTime, doseTime));
        }
        return savedSupplement.getId();
    }

    public static NormalizedScan normalize(String rawJson) {
        if (rawJson != null && rawJson.length() > MAX_PROVIDER_CHARACTERS) {
            throw new IllegalArgumentException("Gemini response is too large");
        }
        try {
            var root = OBJECT_MAPPER.readTree(stripMarkdownFence(rawJson));
            if (root.isTextual()) {
                root = OBJECT_MAPPER.readTree(stripMarkdownFence(root.asText()));
            }
            var ingredients = new ArrayList<IngredientResult>();
            var ingredientsNode = root.path("ingredients");
            if (ingredientsNode.isArray()) {
                var inspected = 0;
                for (JsonNode ingredient : ingredientsNode) {
                    if (inspected++ >= MAX_INGREDIENTS) {
                        break;
                    }
                    if (!ingredient.isObject()) {
                        continue;
                    }

                    var confidence = normalizedConfidence(ingredient.path("confidence").asDouble(0.0));
                    ingredients.add(new IngredientResult(
                        textValue(ingredient, "name", 255),
                        textValue(ingredient, "amount", 80),
                        textValue(ingredient, "unit", 40),
                        textValue(ingredient, "originalText", 10_000),
                        confidence,
                        confidence < REVIEW_CONFIDENCE_THRESHOLD
                    ));
                }
            }

            return new NormalizedScan(
                textValue(root, "brandName", 255),
                normalizedProductName(root, ingredients),
                textValue(root, "suggestedUseOriginal", 10_000),
                textValue(root, "suggestedUseKo", 10_000),
                textValue(root, "warningsOriginal", 10_000),
                textValue(root, "warningsKo", 10_000),
                textValue(root, "originalLabelText", 20_000),
                recommendedDoseTime(root, ingredients),
                List.copyOf(ingredients),
                root.path("research").isObject() ? root.path("research") : null,
                textValue(root, "servingBasisKo", 255),
                root.path("productInformation").isObject() ? root.path("productInformation") : null
            );
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("invalid Gemini JSON", ex);
        }
    }

    private SupplementScan findUserScan(Long userId, Long scanId) {
        return scans.findByIdAndUserId(scanId, userId)
            .orElseThrow(() -> new IllegalArgumentException("scan not found"));
    }

    private ScanResultResponse toResponse(Long scanId, String status, NormalizedScan normalized) {
        return new ScanResultResponse(
            scanId,
            status,
            normalized.brandName(),
            normalized.productName(),
            normalized.suggestedUseKo(),
            normalized.suggestedUseOriginal(),
            normalized.warningsKo(),
            normalized.warningsOriginal(),
            normalized.originalLabelText(),
            normalized.recommendedDoseTime(),
            normalized.ingredients().stream()
                .map(ingredient -> new ScanResultResponse.Ingredient(
                    ingredient.name(),
                    ingredient.amount(),
                    ingredient.unit(),
                    ingredient.originalText(),
                    ingredient.confidence(),
                    ingredient.needsReview()
                ))
                .toList(),
            normalized.research(),
            normalized.servingBasisKo(),
            normalized.productInformation()
        );
    }

    private NormalizedScan emptyScan() {
        return new NormalizedScan("", "", "", "", "", "", "", "", List.of(), null, "", null);
    }

    private String imageMetadata(ValidatedImage frontImage, ValidatedImage backImage) {
        try {
            return OBJECT_MAPPER.writeValueAsString(new ImageMetadata(
                fileMetadata(frontImage),
                fileMetadata(backImage)
            ));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("unable to serialize image metadata", ex);
        }
    }

    private ImageFileMetadata fileMetadata(ValidatedImage image) {
        if (image == null) {
            return null;
        }
        return new ImageFileMetadata(
            image.filename(),
            image.contentType(),
            image.bytes().length
        );
    }

    private String rawGeminiTextJson(String rawJson) {
        try {
            return OBJECT_MAPPER.writeValueAsString(new RawGeminiText(rawJson));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("unable to serialize raw Gemini text", ex);
        }
    }

    private String normalizedJson(NormalizedScan normalized) {
        try {
            return OBJECT_MAPPER.writeValueAsString(normalized);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("unable to serialize normalized scan", ex);
        }
    }

    private List<ConfirmScanRequest.Ingredient> safeIngredients(ConfirmScanRequest request) {
        if (request.ingredients() == null) {
            return Collections.emptyList();
        }
        return request.ingredients();
    }

    private String displayNameKo(ConfirmScanRequest request) {
        var context = safeIngredients(request).stream()
            .flatMap(ingredient -> List.of(ingredient.name(), ingredient.originalText()).stream())
            .toList();
        return SupplementDisplayName.choose(request.productName(), context);
    }

    private List<String> doseTimes(ConfirmScanRequest request) {
        var times = new ArrayList<String>();
        var rawTimes = text(request.confirmedDoseTime()).split(",", -1);
        if (rawTimes.length == 0 || rawTimes.length > 3) {
            throw new IllegalArgumentException("dose times must contain 1 to 3 times");
        }
        for (var rawTime : rawTimes) {
            var time = rawTime.trim();
            if (!CLOCK_TIME_PATTERN.matcher(time).matches()) {
                throw new IllegalArgumentException("invalid dose time");
            }
            if (times.contains(time)) {
                throw new IllegalArgumentException("duplicate dose time");
            }
            times.add(time);
        }

        var doseCount = doseCount(request);
        while (times.size() < doseCount && times.size() < 3) {
            var next = defaultDoseTime(times.size(), doseCount);
            if (!times.contains(next)) {
                times.add(next);
            } else {
                break;
            }
        }
        return List.copyOf(times);
    }

    private int doseCount(ConfirmScanRequest request) {
        var context = String.join(" ",
            text(request.suggestedUseKo()),
            text(request.suggestedUseOriginal()),
            text(request.originalLabelText())
        ).toLowerCase(Locale.ROOT);

        if (containsAny(context, "하루 3번", "1일 3회", "three times", "3 times", "thrice")) {
            return 3;
        }
        if (containsAny(context, "하루 2번", "하루 두번", "하루 두 번", "1일 2회", "twice", "two times", "2 times")) {
            return 2;
        }
        return 1;
    }

    private String defaultDoseTime(int index, int count) {
        if (count >= 3) {
            return switch (index) {
                case 0 -> "09:00";
                case 1 -> "13:00";
                default -> "19:00";
            };
        }
        return switch (index) {
            case 0 -> "09:00";
            default -> "19:00";
        };
    }

    private String text(String value) {
        return value == null ? "" : value;
    }

    private static String stripMarkdownFence(String rawJson) {
        if (rawJson == null || rawJson.isBlank()) {
            throw new IllegalArgumentException("invalid Gemini JSON", new IllegalArgumentException("empty JSON"));
        }

        var trimmed = rawJson.trim();
        if (!trimmed.startsWith("```")) {
            return trimmed;
        }

        var firstLineEnd = trimmed.indexOf('\n');
        if (firstLineEnd < 0) {
            return trimmed;
        }

        var body = trimmed.substring(firstLineEnd + 1).trim();
        if (body.endsWith("```")) {
            return body.substring(0, body.length() - 3).trim();
        }
        return body;
    }

    private static String textValue(JsonNode node, String fieldName, int maxCodePoints) {
        var value = node.path(fieldName);
        if (value.isMissingNode() || value.isNull()) {
            return "";
        }
        return truncate(value.asText(""), maxCodePoints);
    }

    private static String recommendedDoseTime(JsonNode root, List<IngredientResult> ingredients) {
        var providedTime = textValue(root, "recommendedDoseTime", 80).trim();
        if (CLOCK_TIME_PATTERN.matcher(providedTime).matches()) {
            return providedTime;
        }

        var context = doseContext(root, ingredients);
        if (containsAny(context, "probiotic", "lactobacillus", "유산균", "프로바이오틱")) {
            return "08:00";
        }
        if (containsAny(context, "magnesium", "마그네슘", "sleep", "night", "evening", "수면", "저녁")) {
            return "21:00";
        }
        return "09:00";
    }

    private static String normalizedProductName(JsonNode root, List<IngredientResult> ingredients) {
        var productName = textValue(root, "productName", 255).trim();
        var context = doseContext(root, ingredients);
        if (
            isInactiveMagnesiumProductName(productName)
                && containsAny(context, "probiotic", "probiotics", "lactobacillus", "bifidobacterium")
        ) {
            return "Probiotics";
        }
        return productName;
    }

    private static boolean isInactiveMagnesiumProductName(String productName) {
        var normalized = productName.toLowerCase(Locale.ROOT).trim();
        return normalized.equals("magnesium")
            || normalized.equals("magnesium stearate")
            || normalized.contains("magnesium stearate");
    }

    private static double normalizedConfidence(double confidence) {
        if (confidence <= 0.0) {
            return 0.0;
        }
        if (confidence <= 1.0) {
            return confidence;
        }
        if (confidence <= 5.0) {
            return confidence / 5.0;
        }
        if (confidence <= 100.0) {
            return confidence / 100.0;
        }
        return 1.0;
    }

    private static String doseContext(JsonNode root, List<IngredientResult> ingredients) {
        var builder = new StringBuilder();
        append(builder, textValue(root, "brandName", 255));
        append(builder, textValue(root, "productName", 255));
        append(builder, textValue(root, "suggestedUseOriginal", 10_000));
        append(builder, textValue(root, "suggestedUseKo", 10_000));
        append(builder, textValue(root, "originalLabelText", 20_000));
        for (var ingredient : ingredients) {
            append(builder, ingredient.name());
            append(builder, ingredient.originalText());
        }
        return builder.toString().toLowerCase(Locale.ROOT);
    }

    private static String truncate(String value, int maxCodePoints) {
        if (value.codePointCount(0, value.length()) <= maxCodePoints) {
            return value;
        }
        return value.substring(0, value.offsetByCodePoints(0, maxCodePoints));
    }

    private static void append(StringBuilder builder, String value) {
        if (value != null && !value.isBlank()) {
            builder.append(' ').append(value);
        }
    }

    private static boolean containsAny(String text, String... terms) {
        for (var term : terms) {
            if (text.contains(term.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    public record NormalizedScan(
        String brandName,
        String productName,
        String suggestedUseOriginal,
        String suggestedUseKo,
        String warningsOriginal,
        String warningsKo,
        String originalLabelText,
        String recommendedDoseTime,
        List<IngredientResult> ingredients,
        JsonNode research,
        String servingBasisKo,
        JsonNode productInformation
    ) {
    }

    public record IngredientResult(
        String name,
        String amount,
        String unit,
        String originalText,
        double confidence,
        boolean needsReview
    ) {
    }

    private record ImageMetadata(ImageFileMetadata frontImage, ImageFileMetadata backImage) {
    }

    private record ImageFileMetadata(String filename, String contentType, long size) {
    }

    private record RawGeminiText(String text) {
    }
}
