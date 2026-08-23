//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.aroundme.control;

import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class PlaceNamesTest {

    @Test
    void usesNameWhenPresent() {
        assertThat(PlaceNames.resolve(properties("Isar Kebaphaus", null, null, null, null), "catering", "fast_food"))
                .isEqualTo("Isar Kebaphaus");
    }

    @Test
    void blankNameFallsThroughToSyntheticName() {
        assertThat(PlaceNames.resolve(properties("   ", "Lucile-Grahn-Straße", null, null, null), "leisure", "playground"))
                .isEqualTo("Playground (Lucile-Grahn-Straße)");
    }

    @Test
    void secondaryCategoryPreferredOverPrimary() {
        assertThat(PlaceNames.resolve(properties(null, "Ehlersstraße", null, null, null), "leisure", "playground"))
                .isEqualTo("Playground (Ehlersstraße)");
    }

    @Test
    void withoutSecondaryCategoryUsesPrimary() {
        assertThat(PlaceNames.resolve(properties(null, "Einsteinstraße", null, null, null), "catering", null))
                .isEqualTo("Catering (Einsteinstraße)");
    }

    @Test
    void categoryWithoutStreetUsesCity() {
        assertThat(PlaceNames.resolve(properties(null, null, "Munich", null, null), "leisure", "playground"))
                .isEqualTo("Playground (Munich)");
    }

    @Test
    void categoryWithoutLocationReturnsBareLabel() {
        assertThat(PlaceNames.resolve(properties(null, null, null, null, null), "catering", "fast_food"))
                .isEqualTo("Fast Food");
    }

    @Test
    void categoryLabelTitleCasesAndReplacesUnderscores() {
        assertThat(PlaceNames.resolve(properties(null, null, null, null, null), "commercial", "charging_station"))
                .isEqualTo("Charging Station");
    }

    @Test
    void noCategoriesUsesAddressLine1() {
        assertThat(PlaceNames.resolve(properties(null, null, null, "Line One Address", "Full Formatted Address"), null, null))
                .isEqualTo("Line One Address");
    }

    @Test
    void noCategoriesNoAddressUsesFormatted() {
        assertThat(PlaceNames.resolve(properties(null, null, null, null, "Full Formatted Address"), null, null))
                .isEqualTo("Full Formatted Address");
    }

    @Test
    void allMissingUsesUnknownPlace() {
        assertThat(PlaceNames.resolve(properties(null, null, null, null, null), null, null))
                .isEqualTo("Unknown Place");
    }

    private JsonObject properties(String name, String street, String city,
                                  String addressLine1, String formatted) {
        JsonObjectBuilder builder = Json.createObjectBuilder();
        if (name != null) {
            builder.add("name", name);
        }
        if (street != null) {
            builder.add("street", street);
        }
        if (city != null) {
            builder.add("city", city);
        }
        if (addressLine1 != null) {
            builder.add("address_line1", addressLine1);
        }
        if (formatted != null) {
            builder.add("formatted", formatted);
        }
        return builder.build();
    }
}
