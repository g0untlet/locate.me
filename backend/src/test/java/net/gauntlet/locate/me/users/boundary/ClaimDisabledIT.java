//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.boundary;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import java.util.Map;
import org.junit.jupiter.api.Test;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;

/**
 * A deployment can sit in PROD with the one-time legacy claim disabled until
 * the frontend migration UI is live. Login, registration and the migration
 * status probe must keep working.
 */
@QuarkusTest
@TestProfile(ClaimDisabledIT.ClaimDisabledProfile.class)
class ClaimDisabledIT extends AuthTestBase {

    public static class ClaimDisabledProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("auth.claim.enabled", "false");
        }
    }

    @Test
    void claimIsTemporarilyDisabled() {
        given().contentType(ContentType.JSON)
                .body(credentials("legacyHero", PASSWORD, "legacyhero@example.test"))
                .post("/api/auth/claim")
                .then()
                .statusCode(503)
                .body("error", is("Account migration is temporarily disabled"));
    }

    @Test
    void migrationStatusStillReportsTheAccountState() {
        given().when().get("/api/auth/migration-status/legacyHero")
                .then()
                .statusCode(200)
                .body("migrationRequired", is(true));
    }

    @Test
    void registrationAndLoginStayAvailable() {
        String token = register("tusrclaimgate", PASSWORD, "tusrclaimgate@example.test");

        given().auth().oauth2(token)
                .when().get("/api/users/me")
                .then()
                .statusCode(200)
                .body("userId", is("tusrclaimgate"))
                .body("hasPassword", is(true));
    }
}
