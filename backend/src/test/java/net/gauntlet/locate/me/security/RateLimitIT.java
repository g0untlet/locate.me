//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.security;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;

import java.time.Instant;
import java.util.Map;

import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;

/**
 * Verifies the Bucket4j rate limiting (pwa-standard / pwa-critical) and the
 * custom 429 response body. Uses tiny per-user limits so the limits are hit
 * within the test; the IT suite otherwise keeps the rate limiter disabled.
 */
@QuarkusTest
@TestProfile(RateLimitIT.RateLimitProfile.class)
public class RateLimitIT {

    public static class RateLimitProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "quarkus.rate-limiter.enabled", "true",
                    "quarkus.rate-limiter.buckets.pwa-standard.limits[0].permitted-uses", "2",
                    "quarkus.rate-limiter.buckets.pwa-critical.limits[0].permitted-uses", "1");
        }
    }

    @Inject
    EntityManager em;

    @AfterEach
    @Transactional
    void cleanDatabase() {
        em.createQuery("DELETE FROM Position").executeUpdate();
    }

    @Test
    void readRequestsBeyondStandardLimitReturn429WithRetryAfter() {
        given().when().get("/api/positions?userId=validUser").then().statusCode(200);
        given().when().get("/api/positions?userId=validUser").then().statusCode(200);

        given().when().get("/api/positions?userId=validUser")
                .then()
                .statusCode(429)
                .body("error", is("TOO_MANY_REQUESTS"))
                .body("status", is(429))
                .header("Retry-After", notNullValue());
    }

    @Test
    void writeRequestsBeyondCriticalLimitReturn429() {
        JsonObject json = Json.createObjectBuilder()
                .add("userId", "stUser")
                .add("latitude", 48.1351)
                .add("longitude", 11.5820)
                .add("accuracy", 5.0)
                .add("displayName", "Rate Limited")
                .add("timestamp", Instant.now().toString())
                .build();

        given().contentType(ContentType.JSON)
                .body(json.toString())
                .when().post("/api/positions?userId=stUser")
                .then().statusCode(201);

        given().contentType(ContentType.JSON)
                .body(json.toString())
                .when().post("/api/positions?userId=stUser")
                .then()
                .statusCode(429)
                .body("error", is("TOO_MANY_REQUESTS"))
                .body("status", is(429))
                .header("Retry-After", notNullValue());
    }
}
