//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.boundary;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import org.junit.jupiter.api.Test;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
class JwtAuthorizationIT extends AuthTestBase {

    @Test
    void protectedEndpointRejectsMissingToken() {
        given().when().get("/api/users/me")
                .then().statusCode(401);
    }

    @Test
    void protectedEndpointRejectsInvalidToken() {
        given().auth().oauth2("this-is-not-a-jwt")
                .when().get("/api/users/me")
                .then().statusCode(401);
    }

    @Test
    void protectedEndpointRejectsTamperedToken() {
        String token = register("tusrtamper", PASSWORD, "tusrtamper@example.test");
        String[] parts = token.split("\\.");
        parts[2] = (parts[2].charAt(0) == 'A' ? "B" : "A") + parts[2].substring(1);
        String tampered = String.join(".", parts);

        given().auth().oauth2(tampered)
                .when().get("/api/users/me")
                .then().statusCode(401);
    }

    @Test
    void tokenOfDeactivatedAccountIsRejected() {
        String token = register("tusrdeact", PASSWORD, "tusrdeact@example.test");
        disable("tusrdeact");

        given().auth().oauth2(token)
                .when().get("/api/users/me")
                .then()
                .statusCode(401)
                .body("error", is("Authentication required"));
    }

    @Test
    void legacyQueryParameterStillWorksForAnUnmigratedAccount() {
        given().when().get("/api/positions?userId=validUser")
                .then().statusCode(200);
    }
}
