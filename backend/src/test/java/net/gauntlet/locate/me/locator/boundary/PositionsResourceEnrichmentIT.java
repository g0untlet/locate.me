//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.boundary;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
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
import net.gauntlet.locate.me.locator.entity.Position;
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

        // Mock weather client to avoid side effects
        when(weatherClient.forecast(anyDouble(), anyDouble(), anyString())).thenReturn(Json.createObjectBuilder().build());
    }

    @Test
    @Transactional
    public void testCreatePositionWithEnrichment() {
        // Given
        String userId = "validUser";
        JsonObject positionJson = Json.createObjectBuilder()
            .add("latitude", 52.5162)
            .add("longitude", 13.3777)
            .add("timestamp", Instant.now().toString())
            .build();

        // When
        Response response = positionsResource.create(userId, positionJson);
        
        // Then
        assertThat(response.getStatus()).isEqualTo(201);

        Position savedPosition = (Position) em.createQuery("FROM Position p WHERE p.userId = :userId")
                .setParameter("userId", userId)
                .getSingleResult();

        assertThat(savedPosition).isNotNull();
        assertThat(savedPosition.displayName()).isEqualTo("Reichstagsgebäude, Platz der Republik, Tiergarten, Mitte, Berlin, 10557, Deutschland");
        assertThat(savedPosition.osmCategory()).isEqualTo("historic");
        assertThat(savedPosition.osmType()).isEqualTo("memorial");
        assertThat(savedPosition.osmName()).isEqualTo("Reichstagsgebäude");
        assertThat(savedPosition.addressType()).isEqualTo("historic");
        assertThat(savedPosition.road()).isEqualTo("Platz der Republik");
        assertThat(savedPosition.city()).isEqualTo("Berlin");
        assertThat(savedPosition.country()).isEqualTo("Deutschland");
        assertThat(savedPosition.houseNumber()).isNull(); // Not in this response
    }
}
