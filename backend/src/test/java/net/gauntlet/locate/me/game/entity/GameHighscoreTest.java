//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.game.entity;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.StringReader;
import java.time.Instant;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import org.junit.jupiter.api.Test;

/**
 * JSON contract of a stored best: the projection carries the row, and a
 * submission can never set the identity or the game from the body.
 */
class GameHighscoreTest {

    @Test
    void submissionReadsOnlyScoreAndCity() {
        GameHighscore input = GameHighscore.fromJson(Json.createReader(
                new StringReader("{\"score\":120,\"city\":\" München \","
                        + "\"userId\":\"attacker\",\"game\":\"other\",\"achievedAt\":\"2000-01-01T00:00:00Z\"}"))
                .readObject());

        assertThat(input.score()).isEqualTo(120);
        assertThat(input.city()).isEqualTo(" München ");
        assertThat(input.userId()).isNull();
        assertThat(input.game()).isNull();
        assertThat(input.achievedAt()).isNull();
    }

    @Test
    void fractionalAndOutOfRangeScoresReadAsZero() {
        for (String body : new String[]{"{\"score\":12.5}", "{\"score\":\"12\"}",
                "{\"score\":99999999999999999999}", "{}"}) {
            assertThat(GameHighscore.fromJson(Json.createReader(
                            new StringReader(body)).readObject()).score())
                    .as("body %s", body)
                    .isZero();
        }
    }

    @Test
    void projectionCarriesTheStoredRow() {
        Instant achievedAt = Instant.parse("2026-11-26T10:00:00Z");
        JsonObject json = new GameHighscore().userId("legacyHero").game("breakout")
                .score(100).achievedAt(achievedAt).city(null).toJSON();

        assertThat(json.getString("userId")).isEqualTo("legacyHero");
        assertThat(json.getString("game")).isEqualTo("breakout");
        assertThat(json.getJsonNumber("score").longValue()).isEqualTo(100);
        assertThat(json.getString("achievedAt")).isEqualTo(achievedAt.toString());
        assertThat(json.isNull("city")).isTrue();
    }
}
