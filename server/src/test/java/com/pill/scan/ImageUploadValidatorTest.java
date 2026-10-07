package com.pill.scan;

import com.pill.common.UploadTooLargeException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImageUploadValidatorTest {
    private final ImageUploadValidator validator = new ImageUploadValidator();

    @Test
    void detectsJpegPngAndHeicFromFileSignatures() {
        var jpeg = validator.validate(file("photo.bin", "application/octet-stream", jpegBytes()), "front");
        var png = validator.validate(file("photo.jpg", "image/jpeg", pngBytes()), "front");
        var heic = validator.validate(file("photo.heic", "image/heic", heicBytes()), "front");

        assertThat(jpeg.contentType()).isEqualTo("image/jpeg");
        assertThat(png.contentType()).isEqualTo("image/png");
        assertThat(heic.contentType()).isEqualTo("image/heic");
    }

    @Test
    void rejectsSpoofedImageMimeType() {
        var file = file("front.jpg", "image/jpeg", "not-an-image".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> validator.validate(file, "front"))
            .isInstanceOf(InvalidImageException.class);
    }

    @Test
    void rejectsFilesLargerThanEightMegabytes() {
        var bytes = new byte[8 * 1024 * 1024 + 1];
        bytes[0] = (byte) 0xff;
        bytes[1] = (byte) 0xd8;
        bytes[2] = (byte) 0xff;

        assertThatThrownBy(() -> validator.validate(file("large.jpg", "image/jpeg", bytes), "front"))
            .isInstanceOf(UploadTooLargeException.class);
    }

    @Test
    void sanitizesPathLikeControlFilledAndOverlongFilenames() {
        var longName = "a".repeat(300) + ".png";
        var pathLike = "../../private\\folder/\r\n" + longName;

        var image = validator.validate(file(pathLike, "image/png", pngBytes()), "front");

        assertThat(image.filename()).doesNotContain("/", "\\", "\r", "\n");
        assertThat(image.filename().codePointCount(0, image.filename().length())).isLessThanOrEqualTo(255);
    }

    private MockMultipartFile file(String filename, String contentType, byte[] bytes) {
        return new MockMultipartFile("image", filename, contentType, bytes);
    }

    private byte[] jpegBytes() {
        return new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, 0x00};
    }

    private byte[] pngBytes() {
        return new byte[] {
            (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00
        };
    }

    private byte[] heicBytes() {
        return new byte[] {
            0x00, 0x00, 0x00, 0x18,
            0x66, 0x74, 0x79, 0x70,
            0x68, 0x65, 0x69, 0x63,
            0x00, 0x00, 0x00, 0x00,
            0x6d, 0x69, 0x66, 0x31,
            0x68, 0x65, 0x69, 0x63
        };
    }
}
