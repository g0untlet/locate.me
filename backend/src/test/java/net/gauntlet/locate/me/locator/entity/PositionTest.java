//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.entity;

import java.time.Instant;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class PositionTest {

    @Test
    void serializeToJSON() {
        Instant now = Instant.now();
        Position position = new Position()
                .id(1L)
                .userId("user123")
                .latitude(48.1351)
                .longitude(11.5820)
                .accuracy(10.5)
                .displayName("Munich Office")
                .temperature(18.5f)
                .weatherCode(WeatherCode.PARTLY_CLOUDY)
                .timestamp(now);

        JsonObject json = position.toJSON();

        assertThat(json.getJsonNumber("id").longValue()).isEqualTo(1L);
        assertThat(json.getString("userId")).isEqualTo("user123");
        assertThat(json.getJsonNumber("latitude").doubleValue()).isEqualTo(48.1351);
        assertThat(json.getJsonNumber("longitude").doubleValue()).isEqualTo(11.5820);
        assertThat(json.getJsonNumber("accuracy").doubleValue()).isEqualTo(10.5);
        assertThat(json.getString("displayName")).isEqualTo("Munich Office");
        assertThat((float) json.getJsonNumber("temperature").doubleValue()).isEqualTo(18.5f);
        assertThat(json.getJsonNumber("weatherCode").intValue()).isEqualTo(2);
        assertThat(json.getString("timestamp")).isEqualTo(now.toString());
    }

    @Test
    void deserializeFromJSON() {
        Instant now = Instant.now();
        JsonObject json = Json.createObjectBuilder()
                .add("id", 1L)
                .add("userId", "user123")
                .add("latitude", 48.1351)
                .add("longitude", 11.5820)
                .add("accuracy", 10.5)
                .add("displayName", "Munich Office")
                .add("temperature", 18.5f)
                .add("weatherCode", 2)
                .add("timestamp", now.toString())
                .build();

        Position position = Position.fromJSON(json);

        assertThat(position.id()).isEqualTo(1L);
        assertThat(position.userId()).isEqualTo("user123");
        assertThat(position.latitude()).isEqualTo(48.1351);
        assertThat(position.longitude()).isEqualTo(11.5820);
        assertThat(position.accuracy()).isEqualTo(10.5);
        assertThat(position.displayName()).isEqualTo("Munich Office");
        assertThat(position.temperature()).isEqualTo(18.5f);
        assertThat(position.weatherCode()).isEqualTo(WeatherCode.PARTLY_CLOUDY);
        assertThat(position.timestamp()).isEqualTo(now);
    }
}
