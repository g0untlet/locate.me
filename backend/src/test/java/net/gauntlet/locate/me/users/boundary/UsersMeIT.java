//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.boundary;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.hasItem;

import jakarta.json.Json;
import jakarta.json.JsonObject;
import org.junit.jupiter.api.Test;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;

@QuarkusTest
class UsersMeIT extends AuthTestBase {

    @Test
    void profileUpdateOnlyChangesTheName() {
        String token = register("tusrprofile", PASSWORD, "tusrprofile@example.test");
        JsonObject forbiddenBody = Json.createObjectBuilder()
                .add("name", "  New Name  ")
                .add("userId", "hacker")
                .add("email", "hacker@example.test")
                .add("status", "DISABLED")
                .add("roles", Json.createArrayBuilder().add("ADMIN").build())
                .build();

        given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(forbiddenBody.toString())
                .when().put("/api/users/me")
                .then()
                .statusCode(200)
                .body("userId", is("tusrprofile"))
                .body("name", is("New Name"))
                .body("email", is("tusrprofile@example.test"))
                .body("status", is("ACTIVE"))
                .body("roles", hasItem("USER"));

        given().auth().oauth2(token)
                .when().get("/api/users/me")
                .then()
                .statusCode(200)
                .body("userId", is("tusrprofile"))
                .body("email", is("tusrprofile@example.test"))
                .body("roles", hasItem("USER"));
    }

    @Test
    void passwordChangeRequiresTheCurrentPassword() {
        String token = register("tusrpassword", PASSWORD, "tusrpassword@example.test");

        given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(Json.createObjectBuilder()
                        .add("currentPassword", "wrong-password")
                        .add("password", "new-password-456")
                        .build().toString())
                .when().put("/api/users/me/password")
                .then().statusCode(401);

        given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(Json.createObjectBuilder()
                        .add("currentPassword", PASSWORD)
                        .add("password", "new-password-456")
                        .build().toString())
                .when().put("/api/users/me/password")
                .then().statusCode(204);

        given().contentType(ContentType.JSON)
                .body(credentials("tusrpassword", PASSWORD, null))
                .post("/api/auth/login")
                .then().statusCode(401);

        given().contentType(ContentType.JSON)
                .body(credentials("tusrpassword", "new-password-456", null))
                .post("/api/auth/login")
                .then().statusCode(200);
    }

    @Test
    void recoveryEmailChangeRequiresTheCurrentPasswordAndStaysUnique() {
        String token = register("tusrrecover", PASSWORD, "recover@example.test");
        register("tusrother", PASSWORD, "other@example.test");

        given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(Json.createObjectBuilder()
                        .add("currentPassword", "wrong-password")
                        .add("email", "new-recovery@example.test")
                        .build().toString())
                .when().put("/api/users/me/recovery-email")
                .then().statusCode(401);

        given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(Json.createObjectBuilder()
                        .add("currentPassword", PASSWORD)
                        .add("email", "other@example.test")
                        .build().toString())
                .when().put("/api/users/me/recovery-email")
                .then().statusCode(409);

        given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(Json.createObjectBuilder()
                        .add("currentPassword", PASSWORD)
                        .add("email", "New-Recovery@Example.test")
                        .build().toString())
                .when().put("/api/users/me/recovery-email")
                .then().statusCode(204);

        given().auth().oauth2(token)
                .when().get("/api/users/me")
                .then()
                .statusCode(200)
                .body("email", is("new-recovery@example.test"));
    }
}
