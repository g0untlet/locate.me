//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.control;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.json.Json;
import jakarta.json.JsonObject;
import net.gauntlet.locate.me.locator.entity.Position;
import org.junit.jupiter.api.Test;

public class PositionsAddressTest {

    @Test
    void composesAddressPartsWithoutPoiName() {
        JsonObject response = Json.createObjectBuilder()
                .add("category", "shop")
                .add("type", "butcher")
                .add("addresstype", "shop")
                .add("name", "F. Wöhrmüller")
                .add("display_name", "F. Wöhrmüller, 2, Viktualienmarkt, Graggenauerviertel, "
                        + "Altstadt-Lehel, München, Bayern, 80331, Deutschland")
                .add("address", Json.createObjectBuilder()
                        .add("shop", "F. Wöhrmüller")
                        .add("house_number", "2")
                        .add("road", "Viktualienmarkt")
                        .add("quarter", "Graggenauerviertel")
                        .add("suburb", "Altstadt-Lehel")
                        .add("city", "München")
                        .add("state", "Bayern")
                        .add("postcode", "80331")
                        .add("country", "Deutschland")
                        .build())
                .build();
        Position position = new Position();

        Positions.applyAddress(position, response);

        assertThat(position.displayName()).isEqualTo("Viktualienmarkt 2, München, Deutschland");
        assertThat(position.road()).isEqualTo("Viktualienmarkt");
        assertThat(position.houseNumber()).isEqualTo("2");
        assertThat(position.city()).isEqualTo("München");
        assertThat(position.country()).isEqualTo("Deutschland");
        assertThat(position.osmName()).isNull();
    }

    @Test
    void fallsBackToTownForRuralAddresses() {
        JsonObject response = Json.createObjectBuilder()
                .add("display_name", "Kirchstraße, Penzberg, Landkreis Weilheim-Schongau, Bayern, Deutschland")
                .add("address", Json.createObjectBuilder()
                        .add("road", "Kirchstraße")
                        .add("town", "Penzberg")
                        .add("country", "Deutschland")
                        .build())
                .build();
        Position position = new Position();

        Positions.applyAddress(position, response);

        assertThat(position.city()).isEqualTo("Penzberg");
        assertThat(position.displayName()).isEqualTo("Kirchstraße, Penzberg, Deutschland");
    }

    @Test
    void keepsTruncatedRawDisplayNameWithoutAddressParts() {
        String rawName = "A".repeat(300);
        JsonObject response = Json.createObjectBuilder().add("display_name", rawName).build();
        Position position = new Position();

        Positions.applyAddress(position, response);

        assertThat(position.displayName()).hasSize(Positions.DISPLAY_NAME_MAX_LENGTH);
        assertThat(position.city()).isNull();
        assertThat(position.road()).isNull();
    }
}
