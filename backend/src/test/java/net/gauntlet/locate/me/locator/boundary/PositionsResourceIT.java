//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.boundary;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.InjectMock;
import io.restassured.http.ContentType;
import java.time.Instant;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import org.junit.jupiter.api.Test;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.mockito.Mockito;
import net.gauntlet.locate.me.locator.control.GeocodingClient;
import net.gauntlet.locate.me.locator.control.WeatherClient;
import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;

@QuarkusTest
class PositionsResourceIT {

    @InjectMock
    @RestClient
    GeocodingClient geocodingClient;

    @InjectMock
    @RestClient
    WeatherClient weatherClient;

    @Test
    void createAndLifecyclePosition() {
        JsonObject json = Json.createObjectBuilder()
                .add("userId", "validUser")
                .add("latitude", 48.1351)
                .add("longitude", 11.5820)
                .add("accuracy", 5.0)
                .add("displayName", "Test Location")
                .add("timestamp", Instant.now().toString())
                .build();

        // 1. Create Position
        int id = given()
                .contentType(ContentType.JSON)
                .body(json.toString())
                .when()
                .post("/positions?userId=validUser")
                .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("userId", is("validUser"))
                .body("latitude", is(48.1351f))
                .body("longitude", is(11.5820f))
                .body("accuracy", is(5.0f))
                .body("displayName", is("Test Location"))
                .extract()
                .path("id");

        // 2. Find by User ID
        given()
                .when()
                .get("/positions?userId=validUser")
                .then()
                .statusCode(200)
                .body("[0].id", is(id))
                .body("[0].displayName", is("Test Location"));

        // 3. Delete Position
        given()
                .when()
                .delete("/positions/" + id + "?userId=validUser")
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
                .post("/positions?userId=" + longUserId)
                .then()
                .statusCode(400);
    }

    @Test
    void createWithTooLongDisplayName() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 256; i++) {
            sb.append("a");
        }
        JsonObject json = Json.createObjectBuilder()
                .add("userId", "validUser")
                .add("latitude", 48.1351)
                .add("longitude", 11.5820)
                .add("displayName", sb.toString())
                .add("timestamp", Instant.now().toString())
                .build();

        given()
                .contentType(ContentType.JSON)
                .body(json.toString())
                .when()
                .post("/positions?userId=validUser")
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
                .post("/positions?userId=noAccuracyUser")
                .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("accuracy", nullValue())
                .extract()
                .path("id");

        // Cleanup
        given()
                .when()
                .delete("/positions/" + id + "?userId=noAccuracyUser")
                .then()
                .statusCode(204);
    }

    @Test
    void createWithNominatimGeocoding() {
        Mockito.when(this.geocodingClient.reverse(48.1351, 11.5820, "jsonv2"))
                .thenReturn(Json.createObjectBuilder()
                        .add("display_name", "Mocked OSM Munich")
                        .build());

        JsonObject json = Json.createObjectBuilder()
                .add("userId", "geoUser")
                .add("latitude", 48.1351)
                .add("longitude", 11.5820)
                .add("timestamp", Instant.now().toString())
                .build();

        int id = given()
                .contentType(ContentType.JSON)
                .body(json.toString())
                .when()
                .post("/positions?userId=geoUser")
                .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("displayName", is("Mocked OSM Munich"))
                .extract()
                .path("id");

        // Cleanup
        given()
                .when()
                .delete("/positions/" + id + "?userId=geoUser")
                .then()
                .statusCode(204);
    }

    @Test
    void createWithNominatimGeocodingFailure() {
        Mockito.when(this.geocodingClient.reverse(52.5200, 13.4050, "jsonv2"))
                .thenThrow(new RuntimeException("OSM Service Unavailable"));

        JsonObject json = Json.createObjectBuilder()
                .add("userId", "geoFailUser")
                .add("latitude", 52.5200)
                .add("longitude", 13.4050)
                .add("timestamp", Instant.now().toString())
                .build();

        int id = given()
                .contentType(ContentType.JSON)
                .body(json.toString())
                .when()
                .post("/positions?userId=geoFailUser")
                .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("displayName", nullValue())
                .extract()
                .path("id");

        // Cleanup
        given()
                .when()
                .delete("/positions/" + id + "?userId=geoFailUser")
                .then()
                .statusCode(204);
    }

    @Test
    void createWithUnauthorizedUserId() {
        JsonObject json = Json.createObjectBuilder()
                .add("userId", "unauth")
                .add("latitude", 48.1351)
                .add("longitude", 11.5820)
                .add("timestamp", Instant.now().toString())
                .build();

        given()
                .contentType(ContentType.JSON)
                .body(json.toString())
                .when()
                .post("/positions?userId=unauth")
                .then()
                .statusCode(401);
    }

    @Test
    void createWithNonAlphanumericUserId() {
        JsonObject json = Json.createObjectBuilder()
                .add("userId", "user-123")
                .add("latitude", 48.1351)
                .add("longitude", 11.5820)
                .add("timestamp", Instant.now().toString())
                .build();

        given()
                .contentType(ContentType.JSON)
                .body(json.toString())
                .when()
                .post("/positions?userId=user-123")
                .then()
                .statusCode(400);
    }

    @Test
    void getPositionsWithoutUserId() {
        given()
                .when()
                .get("/positions")
                .then()
                .statusCode(400);
    }

    @Test
    void getPositionsWithDistanceCalculation() {
        JsonObject json = Json.createObjectBuilder()
                .add("userId", "validUser")
                .add("latitude", 48.1351)
                .add("longitude", 11.5820)
                .add("timestamp", Instant.now().toString())
                .build();

        // 1. Create a position at Munich
        int id = given()
                .contentType(ContentType.JSON)
                .body(json.toString())
                .when()
                .post("/positions?userId=validUser")
                .then()
                .statusCode(201)
                .extract()
                .path("id");

        // 2. Fetch passing coordinates (at Munich, expect ~0 km distance)
        given()
                .when()
                .get("/positions?userId=validUser&lat=48.1351&lon=11.5820")
                .then()
                .statusCode(200)
                .body("[0].id", is(id))
                .body("[0].distance", notNullValue())
                .body("[0].distance", is(0.0f));

        // 3. Fetch passing coordinates far away (Berlin: 52.5200, 13.4050, expect ~500+ km distance)
        given()
                .when()
                .get("/positions?userId=validUser&lat=52.5200&lon=13.4050")
                .then()
                .statusCode(200)
                .body("[0].id", is(id))
                .body("[0].distance", notNullValue());

        // 4. Fetch without distance parameters, expect NO distance field in response
        given()
                .when()
                .get("/positions?userId=validUser")
                .then()
                .statusCode(200)
                .body("[0].id", is(id))
                .body("[0].distance", nullValue());

        // Cleanup
        given()
                .when()
                .delete("/positions/" + id + "?userId=validUser")
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
