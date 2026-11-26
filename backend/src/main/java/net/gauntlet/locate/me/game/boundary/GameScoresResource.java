//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.game.boundary;

import java.util.Optional;
import io.quarkiverse.bucket4j.runtime.RateLimited;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonValue;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.gauntlet.locate.me.Boundary;
import net.gauntlet.locate.me.game.control.GameScores;
import net.gauntlet.locate.me.game.entity.GameHighscore;
import net.gauntlet.locate.me.users.control.CurrentUser;
import net.gauntlet.locate.me.users.control.UserAccounts;

/**
 * Game high scores for the app's Easter eggs.
 *
 * <p>{@code GET} is public (the community high is not sensitive and the game
 * must load for the shared demo); {@code POST} records the caller's personal
 * best through the same identity policy as the business endpoints (JWT, the
 * exact demo user, or an unmigrated legacy account while the fallback is on).
 * The response always carries the personal and community views together, so a
 * client needs one request.
 */
@Boundary
@Path("/games")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class GameScoresResource {

    static final System.Logger LOG = System.getLogger(GameScoresResource.class.getName());

    @Inject
    GameScores scores;

    @Inject
    UserAccounts users;

    @Inject
    CurrentUser currentUser;

    @GET
    @Path("/{game}/highscore")
    @PermitAll
    @RateLimited(bucket = "pwa-standard")
    public Response highscore(@PathParam("game") String game, @QueryParam("userId") String userId) {
        String normalizedGame = this.scores.normalizeGame(game);
        return Response.ok(highscoreJson(normalizedGame,
                this.scores.personal(normalizedGame, userId),
                this.scores.best(normalizedGame))).build();
    }

    @POST
    @Path("/{game}/highscore")
    @PermitAll
    @Transactional
    @RateLimited(bucket = "pwa-critical")
    public Response submit(@PathParam("game") String game,
                           @QueryParam("userId") String requestedUserId,
                           JsonObject json) {
        String normalizedGame = this.scores.normalizeGame(game);
        String userId = this.currentUser.resolve(requestedUserId);
        GameHighscore input = GameHighscore.fromJson(json);
        boolean recorded = this.scores.submit(normalizedGame, userId, input.score(), input.city());
        LOG.log(recorded ? System.Logger.Level.INFO : System.Logger.Level.DEBUG,
                "Game highscore submission for user {0} in {1}: {2} ({3})",
                userId, normalizedGame, input.score(), recorded ? "new personal best" : "ignored");

        return Response.ok(highscoreJson(normalizedGame,
                this.scores.personal(normalizedGame, userId),
                this.scores.best(normalizedGame))).build();
    }

    private JsonObject highscoreJson(String game,
                                     Optional<GameHighscore> personal,
                                     Optional<GameHighscore> community) {
        JsonObject personalJson = personal
                .map(GameHighscore::toJSON)
                .orElseGet(GameScoresResource::emptyPersonal);

        JsonObject communityJson;
        if (community.isPresent()) {
            GameHighscore best = community.get();
            // The nickname follows the account's current display name, so a
            // later rename is reflected without touching the score row.
            String nickname = this.users.displayName(best.userId()).orElse("anonymous");
            communityJson = Json.createObjectBuilder(best.toJSON())
                    .add("nickname", nickname)
                    .build();
        } else {
            communityJson = Json.createObjectBuilder()
                    .add("score", 0)
                    .add("userId", JsonValue.NULL)
                    .add("nickname", "anonymous")
                    .add("achievedAt", JsonValue.NULL)
                    .add("city", JsonValue.NULL)
                    .build();
        }

        return Json.createObjectBuilder()
                .add("game", game)
                .add("personal", personalJson)
                .add("community", communityJson)
                .build();
    }

    private static JsonObject emptyPersonal() {
        return Json.createObjectBuilder()
                .add("score", 0)
                .add("achievedAt", JsonValue.NULL)
                .add("city", JsonValue.NULL)
                .build();
    }
}
