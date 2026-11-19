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

/**
 * After the frontend migration the legacy fallback is switched off. Only the
 * shared demo user may then use the {@code userId} query parameter; everything
 * else must present a token.
 */
@QuarkusTest
@TestProfile(LegacyFallbackDisabledIT.FallbackDisabledProfile.class)
class LegacyFallbackDisabledIT extends AuthTestBase {

    public static class FallbackDisabledProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("auth.legacy-userid-auth", "false");
        }
    }

    @Test
    void unmigratedLegacyAccountIsRejected() {
        given().when().get("/api/positions?userId=validUser")
                .then().statusCode(401);
    }

    @Test
    void demoUserStillWorksWithoutAToken() {
        given().when().get("/api/positions?userId=user123")
                .then().statusCode(200);
    }

    @Test
    void registeredUserStillWorksWithAToken() {
        String token = register("tusrfallback", PASSWORD, "tusrfallback@example.test");

        given().auth().oauth2(token)
                .when().get("/api/positions")
                .then()
                .statusCode(200)
                .body("size()", is(0));
    }
}
