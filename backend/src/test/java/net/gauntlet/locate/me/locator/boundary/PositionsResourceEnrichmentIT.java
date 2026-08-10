//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.boundary;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.InjectMock;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import net.gauntlet.locate.me.locator.control.GeocodingClient;
import net.gauntlet.locate.me.locator.control.WeatherClient;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import jakarta.inject.Inject;

@QuarkusTest
public class PositionsResourceEnrichmentIT {

    @Inject
    PositionsResource positionsResource;

    @Inject
    EntityManager em;

    @InjectMock
    @RestClient
    GeocodingClient geocodingClient;

    @InjectMock
    @RestClient
    WeatherClient weatherClient;

    @BeforeEach
    @Transactional
    public void setup() {
        em.createQuery("DELETE FROM Position").executeUpdate();
        JsonObject nominatimResponse = Json.createObjectBuilder()
                .add("place_id", 282253481)
                .add("licence", "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright")
                .add("osm_type", "way")
                .add("osm_id", 4323605)
                .add("lat", "52.5162261")
                .add("lon", "13.3777423")
                .add("category", "historic")
                .add("type", "memorial")
                .add("place_rank", 30)
                .add("importance", 0.4385316539599554)
                .add("addresstype", "historic")
                .add("name", "Reichstagsgebäude")
                .add("display_name", "Reichstagsgebäude, Platz der Republik, Tiergarten, Mitte, Berlin, 10557, Deutschland")
                .add("address", Json.createObjectBuilder()
                        .add("historic", "Reichstagsgebäude")
                        .add("road", "Platz der Republik")
                        .add("suburb", "Tiergarten")
                        .add("city_district", "Mitte")
                        .add("city", "Berlin")
                        .add("postcode", "10557")
                        .add("country", "Deutschland")
                        .add("country_code", "de")
                        .build())
                .add("boundingbox", Json.createArrayBuilder()
                        .add("52.5156293")
                        .add("52.5168229")
                        .add("13.3770425")
                        .add("13.3784421")
                        .build())
                .build();
        
        when(geocodingClient.reverse(anyDouble(), anyDouble(), anyString())).thenReturn(nominatimResponse);

        JsonObject weatherResponse = Json.createObjectBuilder()
                .add("elevation", 520)
                .add("current", Json.createObjectBuilder()
                        .add("temperature_2m", 32.3)
                        .add("weather_code", 2)
                        .add("uv_index", 6.6)
                        .build())
                .build();

        when(weatherClient.forecast(anyDouble(), anyDouble(), anyString())).thenReturn(weatherResponse);
    }

    @Test
    @Transactional
    public void testPreviewPositionWithEnrichment() {
        // Given
        String userId = "validUser";

        // When
        Response response = positionsResource.fetchCurrentPosition(userId, 52.5162, 13.3777);

        // Then
        assertThat(response.getStatus()).isEqualTo(200);

        JsonObject json = (JsonObject) response.getEntity();
        assertThat(json.getString("displayName")).isEqualTo("Reichstagsgebäude, Platz der Republik, Tiergarten, Mitte, Berlin, 10557, Deutschland");
        assertThat(json.getString("osmCategory")).isEqualTo("historic");
        assertThat(json.getString("osmType")).isEqualTo("memorial");
        assertThat(json.getString("osmName")).isEqualTo("Reichstagsgebäude");
        assertThat(json.getString("addressType")).isEqualTo("historic");
        assertThat(json.getString("road")).isEqualTo("Platz der Republik");
        assertThat(json.getString("city")).isEqualTo("Berlin");
        assertThat(json.getString("country")).isEqualTo("Deutschland");
        assertThat(json.containsKey("houseNumber")).isFalse(); // Not in this response
        assertThat((float) json.getJsonNumber("temperature").doubleValue()).isEqualTo(32.3f);
        assertThat((float) json.getJsonNumber("uvIndex").doubleValue()).isEqualTo(6.6f);
        assertThat(json.getJsonNumber("elevation").doubleValue()).isEqualTo(520);
        assertThat(json.getJsonNumber("weatherCode").intValue()).isEqualTo(2);

        // And the preview must not be persisted
        Long count = em.createQuery("SELECT COUNT(p) FROM Position p WHERE p.userId = :userId", Long.class)
                .setParameter("userId", userId)
                .getSingleResult();
        assertThat(count).isEqualTo(0);
    }
}
