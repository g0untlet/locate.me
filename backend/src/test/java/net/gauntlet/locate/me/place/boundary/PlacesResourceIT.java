//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.place.boundary;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonObject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import net.gauntlet.locate.me.place.control.GeoapifyPlacesClient;

@QuarkusTest
public class PlacesResourceIT {

    static final String PLACE_ID = "513ee42d573f3627405927d4fa1b59114840f00103f901eba8814f0000000092030e49736172204b6562617068617573";

    @Inject
    EntityManager em;

    @InjectMock
    @RestClient
    GeoapifyPlacesClient geoapifyPlacesClient;

    @BeforeEach
    @Transactional
    public void setup() {
        em.createQuery("DELETE FROM Place").executeUpdate();
        // Default mock: empty result to prevent real Geoapify calls in tests that don't care
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString()))
                .thenReturn(featureCollection());
    }

    @Test
    void fetchPlacesStoresAndReturnsMappedFeatures() {
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString()))
                .thenReturn(featureCollection(feature("Isar Kebaphaus", PLACE_ID, 48.1355319, 11.605952,
                        Json.createArrayBuilder().add("catering").add("catering.fast_food").add("wheelchair").add("wheelchair.yes").build(),
                        Json.createObjectBuilder().add("phone", "+49 89 23542405").build())));

        String geohash = given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200)
                .body("[0].name", is("Isar Kebaphaus"))
                .body("[0].placeId", is(PLACE_ID))
                .body("[0].primaryCategory", is("catering"))
                .body("[0].wheelchair", is("yes"))
                .body("[0].phone", is("+49 89 23542405"))
                .body("[0].formattedAddress", is("Isar Kebaphaus, Einsteinstraße 84, 81675 Munich, Germany"))
                .body("[0].city", is("Munich"))
                .body("[0].country", is("Germany"))
                .body("[0].openingHours", is("Mo-Sa 10:30-21:00"))
                .body("[0].geohash", notNullValue())
                .extract()
                .path("[0].geohash");

        assertThat(geohash).hasSize(9);
        assertThat(countPlaces()).isEqualTo(1);
        assertThat(storedRawJson()).contains("\"place_id\"").contains("\"name\"");
    }

    @Test
    void fetchPlacesWithEmptyFeaturesReturnsEmptyList() {
        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200)
                .body("size()", is(0));

        assertThat(countPlaces()).isZero();
    }

    @Test
    void fetchPlacesWithUnauthorizedUserReturns401() {
        given()
                .when()
                .get("/api/places?userId=unauth&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(401);
    }

    @Test
    void fetchPlacesWithoutUserIdReturns400() {
        given()
                .when()
                .get("/api/places?lat=48.1356&lon=11.6058")
                .then()
                .statusCode(400);
    }

    @Test
    void fetchPlacesWithoutCoordinatesReturns400() {
        given()
                .when()
                .get("/api/places?userId=validUser")
                .then()
                .statusCode(400);
    }

    @Test
    void fetchPlacesWithInvalidLatitudeReturns400() {
        given()
                .when()
                .get("/api/places?userId=validUser&lat=95&lon=11.6058")
                .then()
                .statusCode(400);
    }

    @Test
    void fetchPlacesOnGeoapifyFailureReturns503() {
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString()))
                .thenThrow(new RuntimeException("geoapify down"));

        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(503);
    }

    private JsonObject feature(String name, String placeId, double lat, double lon, JsonArray categories, JsonObject contact) {
        return Json.createObjectBuilder()
                .add("type", "Feature")
                .add("properties", Json.createObjectBuilder()
                        .add("name", name)
                        .add("country", "Germany")
                        .add("city", "Munich")
                        .add("postcode", "81675")
                        .add("street", "Einsteinstraße")
                        .add("housenumber", "84")
                        .add("formatted", name + ", Einsteinstraße 84, 81675 Munich, Germany")
                        .add("categories", categories)
                        .add("contact", contact)
                        .add("opening_hours", "Mo-Sa 10:30-21:00")
                        .add("place_id", placeId))
                .add("geometry", Json.createObjectBuilder()
                        .add("type", "Point")
                        .add("coordinates", Json.createArrayBuilder().add(lon).add(lat)))
                .build();
    }

    private JsonObject featureCollection(JsonObject... features) {
        JsonArrayBuilder array = Json.createArrayBuilder();
        for (JsonObject feature : features) {
            array.add(feature);
        }
        return Json.createObjectBuilder().add("type", "FeatureCollection").add("features", array).build();
    }

    @Transactional
    long countPlaces() {
        return em.createQuery("SELECT COUNT(p) FROM Place p", Long.class).getSingleResult();
    }

    @Transactional
    String storedRawJson() {
        return em.createQuery("SELECT p.rawJson FROM Place p", String.class).getSingleResult();
    }
}
