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
class UsersAdminIT extends AuthTestBase {

    @Test
    void regularUserCannotUseAdminEndpoints() {
        String token = register("tusrplain", PASSWORD, "tusrplain@example.test");

        given().auth().oauth2(token).when().get("/api/users")
                .then().statusCode(403);
        given().auth().oauth2(token).when().delete("/api/users/validUser")
                .then().statusCode(403);
    }

    @Test
    void adminCanCreateReadUpdateAndDeactivate() {
        String token = adminToken();
        JsonObject created = Json.createObjectBuilder()
                .add("userId", "tusradmin1")
                .add("name", "Managed User")
                .add("password", "managed-password-1")
                .add("email", "tusradmin1@example.test")
                .add("roles", Json.createArrayBuilder().add("USER").build())
                .build();

        given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(created.toString())
                .when().post("/api/users")
                .then()
                .statusCode(201)
                .body("userId", is("tusradmin1"));

        given().auth().oauth2(token).when().get("/api/users")
                .then()
                .statusCode(200)
                .body("userId", hasItem("tusradmin1"));

        given().auth().oauth2(token).when().get("/api/users/tusradmin1")
                .then()
                .statusCode(200)
                .body("name", is("Managed User"));

        given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(Json.createObjectBuilder().add("name", "Renamed User").build().toString())
                .when().put("/api/users/tusradmin1")
                .then()
                .statusCode(200)
                .body("name", is("Renamed User"));

        given().auth().oauth2(token).when().delete("/api/users/tusradmin1")
                .then().statusCode(204);

        given().auth().oauth2(token).when().get("/api/users/tusradmin1")
                .then()
                .statusCode(200)
                .body("status", is("DISABLED"));
    }

    @Test
    void adminUpdateCannotChangeIdentityOrPassword() {
        String token = adminToken();
        given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(Json.createObjectBuilder()
                        .add("userId", "tusradmin2")
                        .add("password", "managed-password-2")
                        .add("email", "tusradmin2@example.test")
                        .build().toString())
                .when().post("/api/users")
                .then().statusCode(201);

        given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(Json.createObjectBuilder()
                        .add("userId", "someoneelse")
                        .add("password", "hijacked-password-9")
                        .build().toString())
                .when().put("/api/users/tusradmin2")
                .then().statusCode(409);

        // The original password still works; the attempted password did not apply.
        given().contentType(ContentType.JSON)
                .body(credentials("tusradmin2", "managed-password-2", null))
                .post("/api/auth/login")
                .then().statusCode(200);
        given().contentType(ContentType.JSON)
                .body(credentials("tusradmin2", "hijacked-password-9", null))
                .post("/api/auth/login")
                .then().statusCode(401);
    }

    @Test
    void lastActiveAdminCannotBeDeactivatedOrDemoted() {
        String token = adminToken();

        given().auth().oauth2(token).when().delete("/api/users/adminUser")
                .then().statusCode(409);

        given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(Json.createObjectBuilder()
                        .add("roles", Json.createArrayBuilder().add("USER").build())
                        .build().toString())
                .when().put("/api/users/adminUser")
                .then().statusCode(409);
    }
}
