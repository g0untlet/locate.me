//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.aroundme.entity;

import java.time.Instant;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class PlaceTest {

    @Test
    void serializeToJSON() {
        Instant now = Instant.now();
        Place place = new Place()
                .placeId("p1")
                .cachedAt(now)
                .geohash("u281z0x7d")
                .latitude(48.1355)
                .longitude(11.6059)
                .name("Isar Kebaphaus")
                .primaryCategory("catering")
                .formattedAddress("Isar Kebaphaus, Einsteinstraße 84, 81675 Munich, Germany")
                .street("Einsteinstraße")
                .houseNumber("84")
                .postcode("81675")
                .city("Munich")
                .country("Germany")
                .phone("+49 89 23542405")
                .website("https://example.com")
                .openingHours("Mo-Sa 10:30-21:00")
                .wheelchair("yes")
                .rawJson("{\"raw\":\"payload\"}");

        JsonObject json = place.toJSON();

        assertThat(json.getString("placeId")).isEqualTo("p1");
        assertThat(json.getString("cachedAt")).isEqualTo(now.toString());
        assertThat(json.getString("geohash")).isEqualTo("u281z0x7d");
        assertThat(json.getJsonNumber("latitude").doubleValue()).isEqualTo(48.1355);
        assertThat(json.getJsonNumber("longitude").doubleValue()).isEqualTo(11.6059);
        assertThat(json.getString("name")).isEqualTo("Isar Kebaphaus");
        assertThat(json.getString("primaryCategory")).isEqualTo("catering");
        assertThat(json.getString("formattedAddress")).isEqualTo("Isar Kebaphaus, Einsteinstraße 84, 81675 Munich, Germany");
        assertThat(json.getString("street")).isEqualTo("Einsteinstraße");
        assertThat(json.getString("houseNumber")).isEqualTo("84");
        assertThat(json.getString("postcode")).isEqualTo("81675");
        assertThat(json.getString("city")).isEqualTo("Munich");
        assertThat(json.getString("country")).isEqualTo("Germany");
        assertThat(json.getString("phone")).isEqualTo("+49 89 23542405");
        assertThat(json.getString("website")).isEqualTo("https://example.com");
        assertThat(json.getString("openingHours")).isEqualTo("Mo-Sa 10:30-21:00");
        assertThat(json.getString("wheelchair")).isEqualTo("yes");
        assertThat(json.containsKey("rawJson")).isFalse();
    }
}
