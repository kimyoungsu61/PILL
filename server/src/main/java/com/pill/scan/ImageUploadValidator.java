package com.pill.scan;

import com.pill.common.UploadTooLargeException;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.Set;

@Component
public class ImageUploadValidator {
    private static final int MAX_IMAGE_BYTES = 8 * 1024 * 1024;
    private static final int MAX_FILENAME_CODE_POINTS = 255;
    private static final byte[] PNG_SIGNATURE = {
        (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    };
    private static final Set<String> HEIC_BRANDS = Set.of(
        "heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"
    );

    public ValidatedImage validate(MultipartFile file, String label) {
        if (file == null || file.isEmpty()) {
            throw new InvalidImageException(label + " image is required");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new UploadTooLargeException();
        }

        final byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException exception) {
            throw new InvalidImageException(label + " image could not be read", exception);
        }
        if (bytes.length == 0) {
            throw new InvalidImageException(label + " image is empty");
        }
        if (bytes.length > MAX_IMAGE_BYTES) {
            throw new UploadTooLargeException();
        }

        return new ValidatedImage(bytes, detectContentType(bytes), sanitizeFilename(file.getOriginalFilename()));
    }

    private String detectContentType(byte[] bytes) {
        if (bytes.length >= 3
            && (bytes[0] & 0xff) == 0xff
            && (bytes[1] & 0xff) == 0xd8
            && (bytes[2] & 0xff) == 0xff) {
            return "image/jpeg";
        }
        if (hasPrefix(bytes, PNG_SIGNATURE)) {
            return "image/png";
        }
        if (isHeic(bytes)) {
            return "image/heic";
        }
        throw new InvalidImageException("unsupported image signature");
    }

    private boolean hasPrefix(byte[] bytes, byte[] signature) {
        if (bytes.length < signature.length) {
            return false;
        }
        for (var index = 0; index < signature.length; index++) {
            if (bytes[index] != signature[index]) {
                return false;
            }
        }
        return true;
    }

    private boolean isHeic(byte[] bytes) {
        if (bytes.length < 12 || !"ftyp".equals(ascii(bytes, 4))) {
            return false;
        }
        var declaredSize = Integer.toUnsignedLong(
            (bytes[0] & 0xff) << 24
                | (bytes[1] & 0xff) << 16
                | (bytes[2] & 0xff) << 8
                | (bytes[3] & 0xff)
        );
        var boxEnd = declaredSize == 0 ? bytes.length : Math.min(declaredSize, bytes.length);
        if (boxEnd < 12 || declaredSize > bytes.length) {
            return false;
        }
        if (HEIC_BRANDS.contains(ascii(bytes, 8))) {
            return true;
        }
        for (var offset = 16; offset + 4 <= boxEnd; offset += 4) {
            if (HEIC_BRANDS.contains(ascii(bytes, offset))) {
                return true;
            }
        }
        return false;
    }

    private String ascii(byte[] bytes, int offset) {
        if (offset < 0 || offset + 4 > bytes.length) {
            return "";
        }
        return new String(bytes, offset, 4, StandardCharsets.US_ASCII);
    }

    private String sanitizeFilename(String originalFilename) {
        var cleaned = new StringBuilder();
        if (originalFilename != null) {
            originalFilename.codePoints()
                .filter(codePoint -> !isUnsafeFilenameCodePoint(codePoint))
                .forEach(cleaned::appendCodePoint);
        }
        var normalizedSeparators = cleaned.toString().replace('\\', '/').trim();
        var basename = basename(normalizedSeparators);
        if (basename.isBlank() || ".".equals(basename) || "..".equals(basename)) {
            basename = "image";
        }
        return truncateCodePoints(basename, MAX_FILENAME_CODE_POINTS);
    }

    private String basename(String value) {
        try {
            var filename = Path.of(value).getFileName();
            return filename == null ? "" : filename.toString();
        } catch (InvalidPathException exception) {
            return "image";
        }
    }

    private boolean isUnsafeFilenameCodePoint(int codePoint) {
        var type = Character.getType(codePoint);
        return Character.isISOControl(codePoint)
            || type == Character.FORMAT
            || type == Character.LINE_SEPARATOR
            || type == Character.PARAGRAPH_SEPARATOR;
    }

    private String truncateCodePoints(String value, int maxCodePoints) {
        if (value.codePointCount(0, value.length()) <= maxCodePoints) {
            return value;
        }
        return value.substring(0, value.offsetByCodePoints(0, maxCodePoints));
    }

    public record ValidatedImage(byte[] bytes, String contentType, String filename) {
    }
}
