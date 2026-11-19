//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.boundary;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;

import org.junit.jupiter.api.Test;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;

@QuarkusTest
class AuthLoginIT extends AuthTestBase {

    @Test
    void loginReturnsATokenForRegisteredUser() {
        register("tusrlogin", PASSWORD, "tusrlogin@example.test");

        given().contentType(ContentType.JSON)
                .body(credentials("tusrlogin", PASSWORD, null))
                .post("/api/auth/login")
                .then()
                .statusCode(200)
                .body("token", notNullValue())
                .body("tokenType", is("Bearer"))
                .body("userId", is("tusrlogin"))
                .body("expiresAt", notNullValue());
    }

    @Test
    void wrongPasswordAndUnknownUserReturnTheSameGenericError() {
        register("tusrwrong", PASSWORD, "tusrwrong@example.test");

        given().contentType(ContentType.JSON)
                .body(credentials("tusrwrong", "wrong-password", null))
                .post("/api/auth/login")
                .then()
                .statusCode(401)
                .body("error", is("Invalid credentials"));

        given().contentType(ContentType.JSON)
                .body(credentials("tusrunknown", PASSWORD, null))
                .post("/api/auth/login")
                .then()
                .statusCode(401)
                .body("error", is("Invalid credentials"));
    }

    @Test
    void unmigratedLegacyAccountCannotLogin() {
        given().contentType(ContentType.JSON)
                .body(credentials("legacyHero", PASSWORD, null))
                .post("/api/auth/login")
                .then()
                .statusCode(401)
                .body("error", is("Invalid credentials"));
    }

    @Test
    void disabledAccountCannotLogin() {
        register("tusrdisabled", PASSWORD, "tusrdisabled@example.test");
        disable("tusrdisabled");

        given().contentType(ContentType.JSON)
                .body(credentials("tusrdisabled", PASSWORD, null))
                .post("/api/auth/login")
                .then()
                .statusCode(401)
                .body("error", is("Invalid credentials"));
    }

    @Test
    void successfulLoginAfterSomeFailuresStillWorks() {
        register("tusrretry", PASSWORD, "tusrretry@example.test");

        given().contentType(ContentType.JSON)
                .body(credentials("tusrretry", "wrong-one", null))
                .post("/api/auth/login")
                .then().statusCode(401);
        given().contentType(ContentType.JSON)
                .body(credentials("tusrretry", "wrong-two", null))
                .post("/api/auth/login")
                .then().statusCode(401);

        given().contentType(ContentType.JSON)
                .body(credentials("tusrretry", PASSWORD, null))
                .post("/api/auth/login")
                .then().statusCode(200);
    }

    @Test
    void repeatedFailuresLockTheAccountTemporarily() {
        register("tusrlock", PASSWORD, "tusrlock@example.test");

        for (int attempt = 0; attempt < 5; attempt++) {
            given().contentType(ContentType.JSON)
                    .body(credentials("tusrlock", "wrong-password", null))
                    .post("/api/auth/login")
                    .then().statusCode(401);
        }

        // The cooldown is temporary, but it must reject even the correct password.
        given().contentType(ContentType.JSON)
                .body(credentials("tusrlock", PASSWORD, null))
                .post("/api/auth/login")
                .then()
                .statusCode(401)
                .body("error", is("Invalid credentials"));
    }
}
