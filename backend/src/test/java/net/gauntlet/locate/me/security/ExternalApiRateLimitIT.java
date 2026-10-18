//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.security;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import java.util.Map;

import jakarta.inject.Inject;
import jakarta.json.Json;
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
import net.gauntlet.locate.me.locator.control.GeocodingClient;
import net.gauntlet.locate.me.locator.control.WeatherClient;

/**
 * Verifies that the global external-API buckets are wired into the actual
 * outgoing calls: with a one-token bucket and no wait, the second request that
 * needs the same external API is rejected with the standard 429 response.
 */
@QuarkusTest
@TestProfile(ExternalApiRateLimitIT.ExternalApiProfile.class)
public class ExternalApiRateLimitIT {

    public static class ExternalApiProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "external-api.geoapify.requests", "1",
                    "external-api.geoapify.period-seconds", "3600",
                    "external-api.nominatim.requests", "1",
                    "external-api.nominatim.period-seconds", "3600",
                    "external-api.weather.requests", "100",
                    "external-api.max-wait-seconds", "0");
        }
    }

    @Inject
    EntityManager em;

    @InjectMock
    @RestClient
    GeoapifyPlacesClient geoapifyPlacesClient;

    @InjectMock
    @RestClient
    GeocodingClient geocodingClient;

    @InjectMock
    @RestClient
    WeatherClient weatherClient;

    @BeforeEach
    @Transactional
    public void setup() {
        em.createQuery("DELETE FROM Place").executeUpdate();
        when(geoapifyPlacesClient.places(anyString(), anyString(), anyString(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(emptyFeatureCollection());
        when(geocodingClient.reverse(anyDouble(), anyDouble(), anyString(), anyInt(), anyString()))
                .thenReturn(null);
        when(weatherClient.forecast(anyDouble(), anyDouble(), anyString(), anyString(), anyInt(), anyString()))
                .thenReturn(null);
    }

    @Test
    void geoapifyCallsBeyondGlobalLimitReturn429() {
        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200);

        given()
                .when()
                .get("/api/places?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(429)
                .body("error", is("TOO_MANY_REQUESTS"))
                .body("status", is(429))
                .header("Retry-After", notNullValue());
    }

    @Test
    void nominatimCallsBeyondGlobalLimitReturn429() {
        given()
                .when()
                .get("/api/positions/current?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(200);

        given()
                .when()
                .get("/api/positions/current?userId=validUser&lat=48.1356&lon=11.6058")
                .then()
                .statusCode(429)
                .body("error", is("TOO_MANY_REQUESTS"))
                .body("status", is(429))
                .header("Retry-After", notNullValue());
    }

    private JsonObject emptyFeatureCollection() {
        return Json.createObjectBuilder()
                .add("type", "FeatureCollection")
                .add("features", Json.createArrayBuilder())
                .build();
    }
}
