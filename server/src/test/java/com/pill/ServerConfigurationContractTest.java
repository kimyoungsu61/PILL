package com.pill;

import org.junit.jupiter.api.Test;
import org.w3c.dom.Element;

import javax.xml.parsers.DocumentBuilderFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class ServerConfigurationContractTest {
    @Test
    void usesSupportedSpringBootAndSecurityStarter() throws Exception {
        var document = DocumentBuilderFactory.newInstance()
            .newDocumentBuilder()
            .parse(Path.of("pom.xml").toFile());
        var parent = (Element) document.getElementsByTagName("parent").item(0);
        var parentVersion = parent.getElementsByTagName("version").item(0).getTextContent().trim();
        var artifactIds = document.getElementsByTagName("artifactId");
        var dependencies = IntStream.range(0, artifactIds.getLength())
            .mapToObj(index -> artifactIds.item(index).getTextContent().trim())
            .toList();

        assertThat(parentVersion).isEqualTo("3.5.15");
        assertThat(dependencies).contains("spring-boot-starter-security");
        assertThat(dependencies).doesNotContain("spring-security-crypto");
    }

    @Test
    void keepsSecretsOutOfApplicationConfiguration() throws Exception {
        var configuration = Files.readString(Path.of("src/main/resources/application.yml"));

        assertThat(configuration).contains("password: ${PILL_DB_PASSWORD}");
        assertThat(configuration).doesNotContain("token-secret");
    }

    @Test
    void pinsPatchedLoggingAndJsonDependencyLines() throws Exception {
        var document = DocumentBuilderFactory.newInstance()
            .newDocumentBuilder()
            .parse(Path.of("pom.xml").toFile());
        var properties = (Element) document.getElementsByTagName("properties").item(0);

        assertThat(properties.getElementsByTagName("logback.version").item(0).getTextContent().trim())
            .isEqualTo("1.5.35");
        assertThat(properties.getElementsByTagName("jackson-bom.version").item(0).getTextContent().trim())
            .isEqualTo("2.21.5");
    }
}
