//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.game.entity;

import java.time.Instant;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import jakarta.json.JsonValue;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;

/**
 * A user's best score for one game.
 *
 * <p>There is one row per {@code (user_id, game)}; the community high score is
 * a query over these rows (highest score, earliest achievement on a tie), not a
 * separate record. The {@code game} column is plain text on purpose, so more
 * games can be added without touching the schema.
 */
@Entity
@Table(name = "game_highscores")
public class GameHighscore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Size(max = 32)
    @Column(name = "user_id", length = 32, nullable = false)
    String userId;

    @Size(max = 32)
    @Column(length = 32, nullable = false)
    String game;

    @Column(nullable = false)
    long score;

    @Column(name = "achieved_at", nullable = false)
    Instant achievedAt;

    @Size(max = 128)
    @Column(length = 128)
    String city;

    public GameHighscore() {
    }

    public Long id() {
        return this.id;
    }

    public String userId() {
        return this.userId;
    }

    public GameHighscore userId(String userId) {
        this.userId = userId;
        return this;
    }

    public String game() {
        return this.game;
    }

    public GameHighscore game(String game) {
        this.game = game;
        return this;
    }

    public long score() {
        return this.score;
    }

    public GameHighscore score(long score) {
        this.score = score;
        return this;
    }

    public Instant achievedAt() {
        return this.achievedAt;
    }

    public GameHighscore achievedAt(Instant achievedAt) {
        this.achievedAt = achievedAt;
        return this;
    }

    public String city() {
        return this.city;
    }

    public GameHighscore city(String city) {
        this.city = city;
        return this;
    }

    /**
     * Safe projection of one stored best. The boundary assembles the personal
     * and community views from it; {@code nickname} is resolved at read time
     * and is therefore not part of the entity.
     */
    public JsonObject toJSON() {
        JsonObjectBuilder builder = Json.createObjectBuilder()
                .add("userId", this.userId)
                .add("game", this.game)
                .add("score", this.score)
                .add("city", this.city != null ? Json.createValue(this.city) : JsonValue.NULL);
        if (this.achievedAt != null) {
            builder.add("achievedAt", this.achievedAt.toString());
        } else {
            builder.add("achievedAt", JsonValue.NULL);
        }
        return builder.build();
    }

    /**
     * Reads only the score and the optional city from a score submission. The
     * userId and game are never taken from the body.
     */
    public static GameHighscore fromJson(JsonObject json) {
        GameHighscore highscore = new GameHighscore();
        if (json == null) {
            return highscore;
        }
        if (json.containsKey("score") && !json.isNull("score")) {
            try {
                // Reject fractions and values outside the long range; the
                // control rejects 0 and anything above its maximum.
                highscore.score(json.getJsonNumber("score").bigDecimalValue()
                        .stripTrailingZeros().longValueExact());
            } catch (RuntimeException e) {
                // Leave 0; the control rejects it with a 400.
            }
        }
        highscore.city(string(json, "city"));
        return highscore;
    }

    private static String string(JsonObject json, String name) {
        if (!json.containsKey(name) || json.isNull(name)) {
            return null;
        }
        JsonValue value = json.get(name);
        return value.getValueType() == JsonValue.ValueType.STRING ? json.getString(name) : null;
    }
}
