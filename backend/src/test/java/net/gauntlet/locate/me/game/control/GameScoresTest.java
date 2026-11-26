//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.game.control;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.ws.rs.WebApplicationException;
import org.junit.jupiter.api.Test;

/**
 * Pure validation rules of the game control; the persistence paths are covered
 * by {@code GameScoresResourceIT}.
 */
class GameScoresTest {

    private final GameScores scores = new GameScores();

    @Test
    void gameKeyIsTrimmedAndLowercased() {
        assertThat(this.scores.normalizeGame("  BREAKOUT ")).isEqualTo("breakout");
        assertThat(this.scores.normalizeGame("tetris-2")).isEqualTo("tetris-2");
        assertThat(this.scores.normalizeGame("snake_2")).isEqualTo("snake_2");
    }

    @Test
    void invalidGameKeysAreRejected() {
        for (String game : new String[]{null, "", "   ", "Break out", "breakout!", "a".repeat(33)}) {
            assertThatThrownBy(() -> this.scores.normalizeGame(game))
                    .as("game key %s", game)
                    .isInstanceOf(WebApplicationException.class)
                    .satisfies(error -> assertThat(((WebApplicationException) error).getResponse().getStatus())
                            .isEqualTo(400));
        }
    }

    @Test
    void cityIsTrimmedAndBlankBecomesNull() {
        assertThat(this.scores.normalizeCity(null)).isNull();
        assertThat(this.scores.normalizeCity("   ")).isNull();
        assertThat(this.scores.normalizeCity("  München  ")).isEqualTo("München");
    }

    @Test
    void overlongCityIsRejected() {
        assertThatThrownBy(() -> this.scores.normalizeCity("x".repeat(129)))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(error -> assertThat(((WebApplicationException) error).getResponse().getStatus())
                        .isEqualTo(400));
    }
}
