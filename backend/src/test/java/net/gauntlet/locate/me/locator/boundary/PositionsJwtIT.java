//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.boundary;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import java.time.Instant;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import org.junit.jupiter.api.Test;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import net.gauntlet.locate.me.users.boundary.AuthTestBase;

@QuarkusTest
class PositionsJwtIT extends AuthTestBase {

    @Test
    void tokenSubjectOverridesTheQueryParameter() {
        String token = register("tusrpos", PASSWORD, "tusrpos@example.test");

        given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(position("validUser").toString())
                .when().post("/api/positions?userId=validUser")
                .then()
                .statusCode(201)
                .body("userId", is("tusrpos"));

        given().auth().oauth2(token)
                .when().get("/api/positions?userId=validUser")
                .then()
                .statusCode(200)
                .body("size()", is(1))
                .body("[0].userId", is("tusrpos"));
    }

    @Test
    void positionOfAnotherUserCannotBeDeleted() {
        int id = given().contentType(ContentType.JSON)
                .body(position("validUser").toString())
                .post("/api/positions?userId=validUser")
                .then().statusCode(201)
                .extract().path("id");

        String token = register("tusrdeleter", PASSWORD, "tusrdeleter@example.test");
        given().auth().oauth2(token)
                .when().delete("/api/positions/" + id + "?userId=validUser")
                .then().statusCode(204);

        given().when().get("/api/positions?userId=validUser")
                .then()
                .statusCode(200)
                .body("size()", is(1));
    }

    static JsonObject position(String userId) {
        return Json.createObjectBuilder()
                .add("userId", userId)
                .add("latitude", 48.1351)
                .add("longitude", 11.5820)
                .add("accuracy", 5.0)
                .add("timestamp", Instant.now().toString())
                .build();
    }
}
