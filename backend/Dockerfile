FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /app

COPY pom.xml .
COPY src src

RUN mvn dependency:go-offline
RUN mvn package -DskipTests

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=build /app/target/quarkus-app/quarkus-run.jar /app/quarkus-run.jar
COPY --from=build /app/target/quarkus-app/lib/ /app/lib/
COPY --from=build /app/target/quarkus-app/*.jar /app/
COPY --from=build /app/target/quarkus-app/app/ /app/app/
COPY --from=build /app/target/quarkus/etc/ /app/etc/

EXPOSE 8080

ENV QUARKUS_HTTP_HOST=0.0.0.0

ENTRYPOINT ["java", "-jar", "quarkus-run.jar"]

