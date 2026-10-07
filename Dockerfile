FROM node:24-bookworm-slim AS web
WORKDIR /build/app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
ENV EXPO_PUBLIC_LIVE_API=true
RUN npx expo export --platform web --output-dir dist/web && node scripts/prepare-web.mjs

FROM maven:3.9.9-eclipse-temurin-21 AS server
WORKDIR /build/server
COPY server/pom.xml ./
RUN mvn -B dependency:go-offline
COPY server/src ./src
COPY --from=web /build/app/dist/web ./src/main/resources/static
RUN mvn -B package -DskipTests

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
RUN groupadd --system pill && useradd --system --gid pill pill
COPY --from=server /build/server/target/pill-server-0.0.1-SNAPSHOT.jar /app/pill.jar
ENV SPRING_PROFILES_ACTIVE=production
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65 -XX:+UseSerialGC"
USER pill
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/pill.jar"]
