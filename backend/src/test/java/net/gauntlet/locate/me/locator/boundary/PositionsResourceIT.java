//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.boundary;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import java.time.Instant;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import org.junit.jupiter.api.Test;
import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;

@QuarkusTest
class PositionsResourceIT {

    @Test
    void createAndLifecyclePosition() {
        JsonObject json = Json.createObjectBuilder()
                .add("userId", "validUser")
                .add("latitude", 48.1351)
                .add("longitude", 11.5820)
                .add("accuracy", 5.0)
                .add("timestamp", Instant.now().toString())
                .build();

        // 1. Create Position
        int id = given()
                .contentType(ContentType.JSON)
                .body(json.toString())
                .when()
                .post("/positions")
                .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("userId", is("validUser"))
                .body("latitude", is(48.1351f))
                .body("longitude", is(11.5820f))
                .body("accuracy", is(5.0f))
                .extract()
                .path("id");

        // 2. Find by User ID
        given()
                .when()
                .get("/positions?userId=validUser")
                .then()
                .statusCode(200)
                .body("[0].id", is(id));

        // 3. Delete Position
        given()
                .when()
                .delete("/positions/" + id)
                .then()
                .statusCode(204);

        // 4. Verify Deleted
        given()
                .when()
                .get("/positions?userId=validUser")
                .then()
                .statusCode(200)
                .body("size()", is(0));
    }

    @Test
    void createWithTooLongUserId() {
        String longUserId = "thisUserIdIsLongerThan32CharactersToTriggerValidationException";
        JsonObject json = Json.createObjectBuilder()
                .add("userId", longUserId)
                .add("latitude", 48.1351)
                .add("longitude", 11.5820)
                .add("timestamp", Instant.now().toString())
                .build();

        given()
                .contentType(ContentType.JSON)
                .body(json.toString())
                .when()
                .post("/positions")
                .then()
                .statusCode(400);
    }

    @Test
    void createWithoutOptionalAccuracy() {
        JsonObject json = Json.createObjectBuilder()
                .add("userId", "noAccuracyUser")
                .add("latitude", 48.1351)
                .add("longitude", 11.5820)
                .add("timestamp", Instant.now().toString())
                .build();

        int id = given()
                .contentType(ContentType.JSON)
                .body(json.toString())
                .when()
                .post("/positions")
                .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("accuracy", nullValue())
                .extract()
                .path("id");

        // Cleanup
        given()
                .when()
                .delete("/positions/" + id)
                .then()
                .statusCode(204);
    }

    @Test
    void checkHealthEndpoint() {
        given()
                .when()
                .get("/q/health/ready")
                .then()
                .statusCode(200)
                .body("status", is("UP"))
                .body("checks.find { it.name == 'Database Connection Readiness Check' }.status", is("UP"));
    }
}
