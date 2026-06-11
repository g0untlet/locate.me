//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package test.java.net.gauntlet.locate.me.locator;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
class PositionsSystemIT {

    @Inject
    @RestClient
    PositionsResourceClient client;

    @Test
    void verifyLifecycleWithClient() {
        JsonObject json = Json.createObjectBuilder()
                .add("userId", "stUser")
                .add("latitude", 52.5200)
                .add("longitude", 13.4050)
                .add("accuracy", 15.0)
                .add("timestamp", Instant.now().toString())
                .build();

        // 1. Create Position via REST Client
        try (Response response = this.client.create(json)) {
            assertThat(response.getStatus()).isEqualTo(201);
            JsonObject created = response.readEntity(JsonObject.class);
            assertThat(created.getString("userId")).isEqualTo("stUser");
            long id = created.getJsonNumber("id").longValue();

            // 2. Query Position via REST Client
            try (Response getResponse = this.client.getPositions("stUser")) {
                assertThat(getResponse.getStatus()).isEqualTo(200);
                JsonArray array = getResponse.readEntity(JsonArray.class);
                assertThat(array).isNotEmpty();
                JsonObject queried = array.getJsonObject(0);
                assertThat(queried.getJsonNumber("id").longValue()).isEqualTo(id);
            }

            // 3. Delete Position via REST Client
            try (Response deleteResponse = this.client.delete(id)) {
                assertThat(deleteResponse.getStatus()).isEqualTo(204);
            }

            // 4. Verify deletion
            try (Response getResponse = this.client.getPositions("stUser")) {
                assertThat(getResponse.getStatus()).isEqualTo(200);
                JsonArray array = getResponse.readEntity(JsonArray.class);
                assertThat(array).isEmpty();
            }
        }
    }
}
