//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.aroundme.boundary;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.CoreMatchers.is;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;

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
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import net.gauntlet.locate.me.aroundme.control.GeoapifyPlacesClient;

/**
 * Verifies the aroundme feature when cache reads are disabled
 * (aroundme.read-from-cache=false): every request fetches fresh from Geoapify
 * (the H2 cache is written but never read), excludes still apply, and the
 * freshly fetched places are forwarded to the client.
 */
@QuarkusTest
@TestProfile(PlacesReadCacheDisabledIT.ReadCacheDisabledProfile.class)
public class PlacesReadCacheDisabledIT {

    public static class ReadCacheDisabledProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("aroundme.read-from-cache", "false");
        }
    }

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
    void alwaysFetchesFromGeoapifyWhenCacheReadDisabled() {
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(
                        feature("Isar Kebaphaus", "kebab-id", 48.1356, 11.6058,
                                Json.createArrayBuilder().add("catering").add("catering.fast_food").build())));

        // Even though the first request stores the place in the H2 cache, the
        // identical second request must NOT be served from it: read-from-cache
        // is disabled, so Geoapify is called again.
        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200)
                .body("size()", is(1));

        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200)
                .body("size()", is(1));

        verify(geoapifyPlacesClient, times(2)).places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString());
    }

    @Test
    void stillPersistsFetchedPlacesWhenCacheReadDisabled() {
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(
                        feature("Isar Kebaphaus", "kebab-id", 48.1356, 11.6058,
                                Json.createArrayBuilder().add("catering").add("catering.fast_food").build())));

        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200)
                .body("[0].name", is("Isar Kebaphaus"));

        // The cache is still populated even though it is not read from.
        assertThat(countPlaces()).isEqualTo(1);
    }

    @Test
    void excludesConfiguredCategoriesWhenCacheReadDisabled() {
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(
                        feature("Playground", "playground-id", 48.1356, 11.6058,
                                Json.createArrayBuilder().add("leisure").add("leisure.playground").build())));

        // aroundme.exclude-categories still applies on the fresh-fetch path:
        // the playground is neither returned nor persisted.
        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200)
                .body("size()", is(0));

        assertThat(countPlaces()).isZero();
    }

    private JsonObject feature(String name, String placeId, double lat, double lon, JsonArray categories) {
        return Json.createObjectBuilder()
                .add("type", "Feature")
                .add("properties", Json.createObjectBuilder()
                        .add("name", name)
                        .add("categories", categories)
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
}
