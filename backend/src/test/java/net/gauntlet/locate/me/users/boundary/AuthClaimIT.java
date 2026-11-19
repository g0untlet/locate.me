//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.boundary;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.hasItem;

import java.time.Instant;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import org.junit.jupiter.api.Test;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;

@QuarkusTest
class AuthClaimIT extends AuthTestBase {

    @Test
    void claimMigratesLegacyAccountAndKeepsBusinessData() {
        JsonObject position = Json.createObjectBuilder()
                .add("userId", "legacyHero")
                .add("latitude", 48.1351)
                .add("longitude", 11.5820)
                .add("accuracy", 5.0)
                .add("timestamp", Instant.now().toString())
                .build();
        given().contentType(ContentType.JSON)
                .body(position.toString())
                .post("/api/positions?userId=legacyHero")
                .then().statusCode(201);

        String token = claim("legacyHero", PASSWORD, "legacyhero@example.test");

        given().auth().oauth2(token)
                .when().get("/api/positions")
                .then()
                .statusCode(200)
                .body("size()", is(1))
                .body("[0].userId", is("legacyHero"));

        // Once migrated, the legacy query parameter is no longer an identity.
        given().when().get("/api/positions?userId=legacyHero")
                .then().statusCode(401);

        given().when().get("/api/auth/migration-status/legacyHero")
                .then()
                .statusCode(200)
                .body("migrationRequired", is(false));
    }

    @Test
    void repeatedClaimIsRejected() {
        claim("legacyHero", PASSWORD, "legacyhero@example.test");

        given().contentType(ContentType.JSON)
                .body(credentials("legacyHero", PASSWORD, "legacyhero@example.test"))
                .post("/api/auth/claim")
                .then().statusCode(409);
    }

    @Test
    void claimRejectsTheDemoUser() {
        given().contentType(ContentType.JSON)
                .body(credentials("user123", PASSWORD, "demo@example.test"))
                .post("/api/auth/claim")
                .then().statusCode(403);
    }

    @Test
    void claimRejectsUnknownUser() {
        given().contentType(ContentType.JSON)
                .body(credentials("tusrdoesnotexist", PASSWORD, "tusrunknown@example.test"))
                .post("/api/auth/claim")
                .then().statusCode(404);
    }

    @Test
    void claimRejectsAnEmailOwnedByAnotherUser() {
        register("tusrowner", PASSWORD, "owner@example.test");

        given().contentType(ContentType.JSON)
                .body(credentials("legacyHero", PASSWORD, "owner@example.test"))
                .post("/api/auth/claim")
                .then().statusCode(409);
    }

    @Test
    void claimPreservesTheBootstrappedAdminRole() {
        String token = adminToken();

        given().auth().oauth2(token)
                .when().get("/api/users/me")
                .then()
                .statusCode(200)
                .body("userId", is("adminUser"))
                .body("roles", hasItem("ADMIN"))
                .body("roles", hasItem("USER"));
    }
}
