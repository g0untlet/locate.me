//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.boundary;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.Matchers.hasItem;

import org.junit.jupiter.api.Test;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;

@QuarkusTest
class AuthRegistrationIT extends AuthTestBase {

    @Test
    void registrationReturnsTokenAndSafeProfile() {
        String token = register("tusrone", PASSWORD, "tusrone@example.test");

        given().auth().oauth2(token)
                .when().get("/api/users/me")
                .then()
                .statusCode(200)
                .body("userId", is("tusrone"))
                .body("email", is("tusrone@example.test"))
                .body("status", is("ACTIVE"))
                .body("roles", hasItem("USER"))
                .body("passwordHash", nullValue())
                .body("password", nullValue())
                .body("failedLoginAttempts", nullValue())
                .body("lockedUntil", nullValue());
    }

    @Test
    void registrationNormalizesUserIdToLowerCase() {
        given().contentType(ContentType.JSON)
                .body(credentials("TUsrTwo", PASSWORD, "tusrtwo@example.test"))
                .post("/api/auth/register")
                .then()
                .statusCode(201)
                .body("userId", is("tusrtwo"))
                .body("token", notNullValue());

        // Login is case-insensitive as well and returns the stored identity.
        given().contentType(ContentType.JSON)
                .body(credentials("TUsrTwo", PASSWORD, null))
                .post("/api/auth/login")
                .then()
                .statusCode(200)
                .body("userId", is("tusrtwo"));
    }

    @Test
    void duplicateUserIdIsRejectedCaseInsensitively() {
        register("tusrthree", PASSWORD, "tusrthree@example.test");

        given().contentType(ContentType.JSON)
                .body(credentials("TUsrThree", PASSWORD, "other@example.test"))
                .post("/api/auth/register")
                .then()
                .statusCode(409);
    }

    @Test
    void reservedAndMalformedUserIdsAreRejected() {
        for (String userId : new String[]{"user123", "admin", "system", "ab", " tusrfour", "tusr four", "tusr!"}) {
            given().contentType(ContentType.JSON)
                    .body(credentials(userId, PASSWORD, "tusrfour@example.test"))
                    .post("/api/auth/register")
                    .then()
                    .statusCode(400);
        }
    }

    @Test
    void duplicateEmailIsRejectedCaseInsensitively() {
        register("tusrfive", PASSWORD, "TUsrFive@Example.test");

        given().contentType(ContentType.JSON)
                .body(credentials("tusrsix", PASSWORD, "tusrfive@example.test"))
                .post("/api/auth/register")
                .then()
                .statusCode(409);
    }

    @Test
    void passwordPolicyIsEnforced() {
        given().contentType(ContentType.JSON)
                .body(credentials("tusrseven", "short", "tusrseven@example.test"))
                .post("/api/auth/register")
                .then()
                .statusCode(400);

        given().contentType(ContentType.JSON)
                .body(credentials("tusrseven", "a".repeat(33), "tusrseven@example.test"))
                .post("/api/auth/register")
                .then()
                .statusCode(400);
    }
}
