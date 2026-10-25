//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.aroundme.boundary;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.CoreMatchers.is;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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
import net.gauntlet.locate.me.aroundme.control.Geoboxing;

/**
 * Verifies that a "|"-separated geoapify.categories configuration triggers one
 * Geoapify request per category group, combines the results, deduplicates them
 * and keeps the distance ordering. Also covers the best-effort behavior when
 * individual groups fail.
 */
@QuarkusTest
@TestProfile(PlacesCategoryGroupsIT.CategoryGroupsProfile.class)
public class PlacesCategoryGroupsIT {

    static final double LAT = 48.1356;
    static final double LON = 11.6058;

    public static class CategoryGroupsProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("geoapify.categories", "catering,commercial|tourism.attraction|healthcare");
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
        // Default mock: empty result so groups without a specific stub do not
        // trigger real Geoapify calls.
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection());
    }

    @Test
    void callsGeoapifyOncePerGroupAndCombinesByDistance() {
        JsonObject far = feature("Far Restaurant", "far-id", LAT + Geoboxing.deltaLat(200.0), LON,
                Json.createArrayBuilder().add("catering").add("catering.restaurant").build());
        JsonObject near = feature("Near Attraction", "near-id", LAT + Geoboxing.deltaLat(50.0), LON,
                Json.createArrayBuilder().add("tourism").add("tourism.attraction").build());
        JsonObject mid = feature("Mid Pharmacy", "mid-id", LAT + Geoboxing.deltaLat(100.0), LON,
                Json.createArrayBuilder().add("healthcare").add("healthcare.pharmacy").build());

        when(geoapifyPlacesClient.places(eq("catering,commercial"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(far));
        when(geoapifyPlacesClient.places(eq("tourism.attraction"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(near));
        when(geoapifyPlacesClient.places(eq("healthcare"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(mid));

        given()
                .when()
                .get("/api/places?userId=validUser&lat=" + LAT + "&lon=" + LON)
                .then()
                .statusCode(200)
                .body("size()", is(3))
                .body("[0].name", is("Near Attraction"))
                .body("[0].primaryCategory", is("tourism"))
                .body("[0].secondaryCategory", is("attraction"))
                .body("[1].name", is("Mid Pharmacy"))
                .body("[2].name", is("Far Restaurant"));

        verify(geoapifyPlacesClient, times(1)).places(eq("catering,commercial"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString());
        verify(geoapifyPlacesClient, times(1)).places(eq("tourism.attraction"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString());
        verify(geoapifyPlacesClient, times(1)).places(eq("healthcare"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString());
        assertThat(countPlaces()).isEqualTo(3);
    }

    @Test
    void returnsMoreThanOneGroupResultBudget() {
        when(geoapifyPlacesClient.places(eq("catering,commercial"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(features("catering", 25,
                        Json.createArrayBuilder().add("catering").add("catering.restaurant").build())));
        when(geoapifyPlacesClient.places(eq("tourism.attraction"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(features("tourism", 25,
                        Json.createArrayBuilder().add("tourism").add("tourism.attraction").build())));

        // aroundme.max-places is per group (20), so three configured groups allow
        // up to 60 places; 50 are returned here (25 + 25 + 0).
        given()
                .when()
                .get("/api/places?userId=validUser&lat=" + LAT + "&lon=" + LON)
                .then()
                .statusCode(200)
                .body("size()", is(50));

        verify(geoapifyPlacesClient, times(1)).places(eq("healthcare"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString());
        assertThat(countPlaces()).isEqualTo(50);
    }

    @Test
    void cacheHitReturnsCombinedGroupedPlacesWithoutRefetching() {
        when(geoapifyPlacesClient.places(eq("catering,commercial"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(features("catering", 25,
                        Json.createArrayBuilder().add("catering").add("catering.restaurant").build())));
        when(geoapifyPlacesClient.places(eq("tourism.attraction"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(features("tourism", 25,
                        Json.createArrayBuilder().add("tourism").add("tourism.attraction").build())));

        given()
                .when()
                .get("/api/places?userId=validUser&lat=" + LAT + "&lon=" + LON)
                .then()
                .statusCode(200)
                .body("size()", is(50));

        // Same coordinates again: the combined cache result is served without
        // another Geoapify request, and the per-group response budget applies.
        given()
                .when()
                .get("/api/places?userId=validUser&lat=" + LAT + "&lon=" + LON)
                .then()
                .statusCode(200)
                .body("size()", is(50));

        verify(geoapifyPlacesClient, times(1)).places(eq("catering,commercial"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString());
        verify(geoapifyPlacesClient, times(1)).places(eq("tourism.attraction"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString());
        verify(geoapifyPlacesClient, times(1)).places(eq("healthcare"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString());
        assertThat(countPlaces()).isEqualTo(50);
    }

    @Test
    void deduplicatesPlaceReturnedByMoreThanOneGroup() {
        JsonObject shared = feature("Shared Place", "shared-id", LAT, LON,
                Json.createArrayBuilder().add("catering").add("catering.restaurant").build());
        when(geoapifyPlacesClient.places(eq("catering,commercial"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(shared));
        when(geoapifyPlacesClient.places(eq("tourism.attraction"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(shared));

        given()
                .when()
                .get("/api/places?userId=validUser&lat=" + LAT + "&lon=" + LON)
                .then()
                .statusCode(200)
                .body("size()", is(1))
                .body("[0].placeId", is("shared-id"));

        assertThat(countPlaces()).isEqualTo(1);
    }

    @Test
    void returnsPartialResultsWhenOneGroupFails() {
        JsonObject catering = feature("Restaurant", "restaurant-id", LAT + Geoboxing.deltaLat(20.0), LON,
                Json.createArrayBuilder().add("catering").add("catering.restaurant").build());
        JsonObject healthcare = feature("Pharmacy", "pharmacy-id", LAT + Geoboxing.deltaLat(40.0), LON,
                Json.createArrayBuilder().add("healthcare").add("healthcare.pharmacy").build());

        when(geoapifyPlacesClient.places(eq("catering,commercial"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(catering));
        when(geoapifyPlacesClient.places(eq("tourism.attraction"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString()))
                .thenThrow(new RuntimeException("geoapify down for tourism"));
        when(geoapifyPlacesClient.places(eq("healthcare"), anyString(), anyString(), eq(20), anyString(), anyString(), anyString()))
                .thenReturn(featureCollection(healthcare));

        given()
                .when()
                .get("/api/places?userId=validUser&lat=" + LAT + "&lon=" + LON)
                .then()
                .statusCode(200)
                .body("size()", is(2))
                .body("[0].name", is("Restaurant"))
                .body("[1].name", is("Pharmacy"));

        assertThat(countPlaces()).isEqualTo(2);
    }

    @Test
    void returns503WhenEveryGroupFails() {
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenThrow(new RuntimeException("geoapify down"));

        given()
                .when()
                .get("/api/places?userId=validUser&lat=" + LAT + "&lon=" + LON)
                .then()
                .statusCode(503);

        assertThat(countPlaces()).isZero();
    }

    private JsonObject[] features(String idPrefix, int count, JsonArray categories) {
        JsonObject[] features = new JsonObject[count];
        for (int i = 0; i < count; i++) {
            features[i] = feature(idPrefix + " Place " + i, idPrefix + "-" + i,
                    LAT + Geoboxing.deltaLat(i * 2.0), LON, categories);
        }
        return features;
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
