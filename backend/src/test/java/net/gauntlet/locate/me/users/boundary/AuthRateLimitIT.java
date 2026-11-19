//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.boundary;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;

import java.util.Map;
import org.junit.jupiter.api.Test;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;

/**
 * Verifies the programmatic authentication buckets. The general IT suite
 * disables them; this profile makes them tiny so they can be hit.
 */
@QuarkusTest
@TestProfile(AuthRateLimitIT.TinyLimitsProfile.class)
class AuthRateLimitIT extends AuthTestBase {

    public static class TinyLimitsProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "auth.rate-limit.login.permitted-uses", "2",
                    "auth.rate-limit.registration.permitted-uses", "1",
                    "auth.rate-limit.claim.permitted-uses", "1",
                    "auth.rate-limit.migration-status.permitted-uses", "1",
                    "auth.rate-limit.demo.permitted-uses", "1");
        }
    }

    @Test
    void loginBeyondTheLimitReturns429WithRetryAfter() {
        given().contentType(ContentType.JSON)
                .body(credentials("tusrunknown", "wrong-password", null))
                .post("/api/auth/login")
                .then().statusCode(401);
        given().contentType(ContentType.JSON)
                .body(credentials("tusrunknown", "wrong-password", null))
                .post("/api/auth/login")
                .then().statusCode(401);

        given().contentType(ContentType.JSON)
                .body(credentials("tusrunknown", "wrong-password", null))
                .post("/api/auth/login")
                .then()
                .statusCode(429)
                .body("error", is("TOO_MANY_REQUESTS"))
                .header("Retry-After", notNullValue());
    }

    @Test
    void registrationBeyondTheLimitReturns429() {
        given().contentType(ContentType.JSON)
                .body(credentials("tusrlimit", PASSWORD, "tusrlimit@example.test"))
                .post("/api/auth/register")
                .then().statusCode(201);

        given().contentType(ContentType.JSON)
                .body(credentials("tusrlimit2", PASSWORD, "tusrlimit2@example.test"))
                .post("/api/auth/register")
                .then().statusCode(429);
    }

    @Test
    void migrationStatusChecksAreLimited() {
        given().when().get("/api/auth/migration-status/legacyHero")
                .then().statusCode(200);
        given().when().get("/api/auth/migration-status/legacyHero")
                .then().statusCode(429);
    }

    @Test
    void demoRequestsUseTheirOwnStricterLimit() {
        given().when().get("/api/positions?userId=user123")
                .then().statusCode(200);
        given().when().get("/api/positions?userId=user123")
                .then().statusCode(429);
    }
}
