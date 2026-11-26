//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.game.control;

import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import net.gauntlet.locate.me.Control;
import net.gauntlet.locate.me.security.AuthErrors;
import net.gauntlet.locate.me.game.entity.GameHighscore;

/**
 * Personal bests and the community high score.
 *
 * <p>The community best is derived from the per-user rows: highest score first,
 * then the earliest achievement, then the userId as a deterministic tie-break.
 * A submission only replaces the caller's own row when it is strictly higher,
 * so a stale device can never overwrite a better score.
 */
@Control
public class GameScores {

    static final System.Logger LOG = System.getLogger(GameScores.class.getName());

    static final Pattern GAME_KEY = Pattern.compile("[a-z0-9_-]{1,32}");

    static final int MAX_USER_ID_LENGTH = 32;

    static final int MAX_CITY_LENGTH = 128;

    static final long MAX_SCORE = 1_000_000_000L;

    @Inject
    EntityManager em;

    /**
     * Normalizes and validates the game key from the path. Lower case keeps the
     * rows for one game together even if a client uses a different casing.
     */
    public String normalizeGame(String game) {
        if (game == null || game.isBlank()) {
            throw AuthErrors.badRequest("game is mandatory");
        }
        String normalized = game.strip().toLowerCase(Locale.ROOT);
        if (!GAME_KEY.matcher(normalized).matches()) {
            throw AuthErrors.badRequest("game is invalid");
        }
        return normalized;
    }

    /**
     * The caller's best. An unknown or empty userId simply has no personal
     * best; the game endpoint does not authenticate this read.
     */
    public Optional<GameHighscore> personal(String game, String userId) {
        if (userId == null || userId.isBlank()) {
            return Optional.empty();
        }
        String lookup = userId.strip();
        if (lookup.length() > MAX_USER_ID_LENGTH) {
            return Optional.empty();
        }
        return this.em.createQuery(
                        "SELECT g FROM GameHighscore g WHERE g.game = :game AND LOWER(g.userId) = :userId",
                        GameHighscore.class)
                .setParameter("game", game)
                .setParameter("userId", lookup.toLowerCase(Locale.ROOT))
                .getResultList().stream().findFirst();
    }

    /**
     * The community high score: highest score, earliest achievement on a tie.
     */
    public Optional<GameHighscore> best(String game) {
        return this.em.createQuery(
                        "SELECT g FROM GameHighscore g WHERE g.game = :game "
                                + "ORDER BY g.score DESC, g.achievedAt ASC, g.userId ASC",
                        GameHighscore.class)
                .setParameter("game", game)
                .setMaxResults(1)
                .getResultList().stream().findFirst();
    }

    /**
     * Records a submission. Returns true when the caller's personal best was
     * actually replaced (or created); a lower or equal score is ignored.
     */
    public boolean submit(String game, String userId, long score, String city) {
        if (score <= 0 || score > MAX_SCORE) {
            throw AuthErrors.badRequest("score is invalid");
        }
        String normalizedCity = normalizeCity(city);
        Instant now = Instant.now();

        Optional<GameHighscore> existing = personal(game, userId);
        if (existing.isEmpty()) {
            GameHighscore row = new GameHighscore()
                    .game(game)
                    .userId(userId)
                    .score(score)
                    .achievedAt(now)
                    .city(normalizedCity);
            try {
                this.em.persist(row);
                this.em.flush();
            } catch (PersistenceException e) {
                // A concurrent submission for the same (user, game) won the
                // unique constraint; the next page load shows that result.
                throw AuthErrors.conflict("score was already recorded");
            }
            return true;
        }

        GameHighscore row = existing.get();
        if (score <= row.score()) {
            LOG.log(System.Logger.Level.DEBUG,
                    "Ignoring lower/equal highscore submission for user {0} in {1}: {2} <= {3}",
                    userId, game, score, row.score());
            return false;
        }
        row.score(score)
                .achievedAt(now)
                .city(normalizedCity);
        this.em.flush();
        return true;
    }

    String normalizeCity(String city) {
        if (city == null) {
            return null;
        }
        String trimmed = city.strip();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > MAX_CITY_LENGTH) {
            throw AuthErrors.badRequest("city is too long");
        }
        return trimmed;
    }
}
