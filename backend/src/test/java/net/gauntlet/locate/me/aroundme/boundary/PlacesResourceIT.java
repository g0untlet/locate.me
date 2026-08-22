//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.aroundme.boundary;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;

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
import io.restassured.response.Response;
import net.gauntlet.locate.me.aroundme.control.GeoapifyPlacesClient;
import net.gauntlet.locate.me.aroundme.control.Geoboxing;

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
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection());
    }

    @Test
    void fetchPlacesStoresAndReturnsMappedFeatures() {
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
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
                .body("[0].secondaryCategory", is("fast_food"))
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
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenThrow(new RuntimeException("geoapify down"));

        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(503);
    }

    @Test
    void refetchingSamePlaceIdUpdatesInsteadOfDuplicating() throws InterruptedException {
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(feature("Isar Kebaphaus", PLACE_ID, 48.1355319, 11.605952,
                        Json.createArrayBuilder().add("catering").add("catering.fast_food").build(),
                        Json.createObjectBuilder().build())));

        String firstCachedAt = given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200)
                .body("size()", is(1))
                .body("[0].placeId", is(PLACE_ID))
                .extract()
                .path("[0].cachedAt");

        Thread.sleep(20);

        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(feature("Isar Kebaphaus Renovated", PLACE_ID, 48.1355319, 11.605952,
                        Json.createArrayBuilder().add("catering").add("catering.fast_food").build(),
                        Json.createObjectBuilder().build())));

        String secondCachedAt = given()
                .when()
                .get("/api/places?userId=validUser&lat=52.5200&lon=13.4050")
                .then()
                .statusCode(200)
                .body("size()", is(1))
                .body("[0].name", is("Isar Kebaphaus Renovated"))
                .body("[0].placeId", is(PLACE_ID))
                .extract()
                .path("[0].cachedAt");

        assertThat(Instant.parse(secondCachedAt)).isAfter(Instant.parse(firstCachedAt));
        assertThat(countPlaces()).isEqualTo(1);
    }

    @Test
    void distinctPlaceIdsWithSameCoordinatesCoexist() {
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(
                        feature("Tenant A", PLACE_ID, 48.1355319, 11.605952,
                                Json.createArrayBuilder().add("catering").add("catering.fast_food").build(),
                                Json.createObjectBuilder().build()),
                        feature("Tenant B", "second-place-id", 48.1355319, 11.605952,
                                Json.createArrayBuilder().add("catering").add("catering.bar").build(),
                                Json.createObjectBuilder().build())));

        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200)
                .body("size()", is(2));

        assertThat(countPlaces()).isEqualTo(2);
    }

    @Test
    void cacheHitReturnsStoredPlacesWithoutCallingGeoapify() {
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(
                        feature("Tenant A", PLACE_ID, 48.1356, 11.6058,
                                Json.createArrayBuilder().add("catering").add("catering.fast_food").build(),
                                Json.createObjectBuilder().build()),
                        feature("Tenant B", "second-place-id", 48.1360, 11.6060,
                                Json.createArrayBuilder().add("catering").add("catering.bar").build(),
                                Json.createObjectBuilder().build())));

        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200)
                .body("size()", is(2));

        // Same coordinates again: served from the H2 cache, no Geoapify call.
        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200)
                .body("size()", is(2));

        verify(geoapifyPlacesClient, times(1)).places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString());
        assertThat(countPlaces()).isEqualTo(2);
    }

    @Test
    void cacheHitSortedByDistanceAscending() {
        double lat = 48.1356;
        double lon = 11.6058;
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(
                        feature("Fifty Meters", "p-50m", lat + Geoboxing.deltaLat(50.0), lon,
                                Json.createArrayBuilder().add("catering").add("catering.fast_food").build(),
                                Json.createObjectBuilder().build()),
                        feature("Thirty Meters", "p-30m", lat + Geoboxing.deltaLat(30.0), lon,
                                Json.createArrayBuilder().add("catering").add("catering.fast_food").build(),
                                Json.createObjectBuilder().build()),
                        feature("At Point", "p-0m", lat, lon,
                                Json.createArrayBuilder().add("catering").add("catering.fast_food").build(),
                                Json.createObjectBuilder().build())));

        Response first = given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200)
                .body("[0].name", is("At Point"))
                .body("[1].name", is("Thirty Meters"))
                .body("[2].name", is("Fifty Meters"))
                .extract()
                .response();

        assertThat(((Number) first.jsonPath().get("[0].distance")).doubleValue()).isCloseTo(0.0, within(1.0));
        assertThat(((Number) first.jsonPath().get("[1].distance")).doubleValue()).isCloseTo(30.0, within(1.0));
        assertThat(((Number) first.jsonPath().get("[2].distance")).doubleValue()).isCloseTo(50.0, within(1.0));

        // Cache hit keeps the same ascending order without re-fetching.
        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200)
                .body("[0].name", is("At Point"))
                .body("[1].name", is("Thirty Meters"))
                .body("[2].name", is("Fifty Meters"));

        verify(geoapifyPlacesClient, times(1)).places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString());
    }

    @Test
    void cacheMissAtFarCoordinateFetchesFromGeoapify() {
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(feature("Munich Place", PLACE_ID, 48.1356, 11.6058,
                        Json.createArrayBuilder().add("catering").add("catering.fast_food").build(),
                        Json.createObjectBuilder().build())));

        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200)
                .body("size()", is(1));

        // Far away coordinate: the cache box is empty, so Geoapify is queried again.
        given()
                .when()
                .get("/api/places?userId=validUser&lat=52.5200&lon=13.4050")
                .then()
                .statusCode(200)
                .body("size()", is(1));

        verify(geoapifyPlacesClient, times(2)).places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString());
    }

    @Test
    void cacheHitExcludesPlacesBeyondRadius() {
        double lat = 48.1356;
        double lon = 11.6058;
        double dLat = Geoboxing.deltaLat(60.0);
        double dLon = Geoboxing.deltaLon(60.0, lat);
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(feature("Corner Place", PLACE_ID, lat + 0.75 * dLat, lon + 0.75 * dLon,
                        Json.createArrayBuilder().add("catering").add("catering.fast_food").build(),
                        Json.createObjectBuilder().build())));

        // First request: cache miss, place stored.
        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200)
                .body("size()", is(1));

        // Second request: the place lies inside the 60 m box but outside the 60 m circle
        // (0.75 * 60 m north-east -> ~63 m), so it is not served from the cache
        // and Geoapify is queried again.
        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200)
                .body("size()", is(1));

        verify(geoapifyPlacesClient, times(2)).places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString());
    }

    @Test
    void passesClientLanguageToGeoapify() {
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection());

        given()
                .header("Accept-Language", "fr-FR,fr;q=0.9,en;q=0.8")
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200);

        verify(geoapifyPlacesClient).places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), eq("fr"));
    }

    @Test
    void defaultsLanguageToEnglishWhenHeaderMissing() {
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection());

        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200);

        verify(geoapifyPlacesClient).places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), eq("en"));
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
