//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.boundary;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import org.junit.jupiter.api.Test;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;

@QuarkusTest
class DemoUserIT extends AuthTestBase {

    @Test
    void demoUserWorksWithoutToken() {
        given().when().get("/api/positions?userId=user123")
                .then().statusCode(200);
    }

    @Test
    void demoUserCannotBeClaimed() {
        given().contentType(ContentType.JSON)
                .body(credentials("user123", PASSWORD, "demo@example.test"))
                .post("/api/auth/claim")
                .then().statusCode(403);
    }

    @Test
    void demoUserCannotBeRegistered() {
        given().contentType(ContentType.JSON)
                .body(credentials("user123", PASSWORD, "demo@example.test"))
                .post("/api/auth/register")
                .then().statusCode(400);
    }

    @Test
    void demoUserIsNeverReportedAsMigratable() {
        given().when().get("/api/auth/migration-status/user123")
                .then()
                .statusCode(200)
                .body("migrationRequired", is(false));
    }

    @Test
    void demoUserHasNoPasswordAndCannotLogIn() {
        given().contentType(ContentType.JSON)
                .body(credentials("user123", PASSWORD, null))
                .post("/api/auth/login")
                .then()
                .statusCode(401)
                .body("error", is("Invalid credentials"));
    }
}
