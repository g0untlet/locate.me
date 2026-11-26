//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.game.boundary;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import java.time.Instant;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.ValidatableResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import net.gauntlet.locate.me.game.entity.GameHighscore;
import net.gauntlet.locate.me.users.boundary.AuthTestBase;

@QuarkusTest
class GameScoresResourceIT extends AuthTestBase {

    @BeforeEach
    void clearGameScores() {
        QuarkusTransaction.requiringNew().run(() ->
                this.em.createQuery("DELETE FROM GameHighscore").executeUpdate());
    }

    @Test
    void emptyHighscoreIsZeroAndAnonymous() {
        given().when().get("/api/games/breakout/highscore")
                .then()
                .statusCode(200)
                .body("game", is("breakout"))
                .body("personal.score", is(0))
                .body("community.score", is(0))
                .body("community.nickname", is("anonymous"));
    }

    @Test
    void personalBestAndCommunityFollowTheHighestScore() {
        String token = register("tusrgame", PASSWORD, "tusrgame@example.test", "Game Hero");

        submit(token, 120)
                .body("personal.score", is(120))
                .body("community.score", is(120))
                .body("community.userId", is("tusrgame"))
                .body("community.nickname", is("Game Hero"));

        given().when().get("/api/games/breakout/highscore?userId=tusrgame")
                .then()
                .statusCode(200)
                .body("personal.score", is(120))
                .body("community.nickname", is("Game Hero"));

        submit(token, 100)
                .body("personal.score", is(120))
                .body("community.score", is(120));

        submit(token, 300)
                .body("personal.score", is(300))
                .body("community.score", is(300));
    }

    @Test
    void legacyAndDemoSubmissionsAreAllowedAndAnonymous() {
        given().contentType(ContentType.JSON)
                .body("{\"score\":50}")
                .post("/api/games/breakout/highscore?userId=legacyHero")
                .then()
                .statusCode(200)
                .body("personal.score", is(50))
                .body("community.userId", is("legacyHero"))
                .body("community.nickname", is("anonymous"));

        given().contentType(ContentType.JSON)
                .body("{\"score\":70}")
                .post("/api/games/breakout/highscore?userId=user123")
                .then()
                .statusCode(200)
                .body("community.score", is(70))
                .body("community.userId", is("user123"))
                .body("community.nickname", is("anonymous"));
    }

    @Test
    void missingIdentityIsRejected() {
        given().contentType(ContentType.JSON)
                .body("{\"score\":10}")
                .post("/api/games/breakout/highscore")
                .then().statusCode(400);

        register("tusrnoauth", PASSWORD, "tusrnoauth@example.test");
        given().contentType(ContentType.JSON)
                .body("{\"score\":10}")
                .post("/api/games/breakout/highscore?userId=tusrnoauth")
                .then().statusCode(401);
    }

    @Test
    void invalidGameAndScoreAreRejected() {
        given().when().get("/api/games/Breakout!/highscore")
                .then().statusCode(400);

        for (String body : new String[]{
                "{\"score\":0}",
                "{\"score\":-1}",
                "{\"score\":1000000001}",
                "{\"score\":12.5}",
                "{\"score\":\"x\"}",
                "{}"}) {
            given().contentType(ContentType.JSON)
                    .body(body)
                    .post("/api/games/breakout/highscore?userId=legacyHero")
                    .then().statusCode(400);
        }
    }

    @Test
    void gameKeyAndPersonalLookupAreCaseInsensitive() {
        String token = register("tusrgamecase", PASSWORD, "tusrgamecase@example.test", "Case Hero");
        submit(token, 42);

        given().when().get("/api/games/BREAKOUT/highscore?userId=TUSRGAMECASE")
                .then()
                .statusCode(200)
                .body("game", is("breakout"))
                .body("personal.score", is(42))
                .body("community.nickname", is("Case Hero"));
    }

    @Test
    void earlierAchievementWinsATie() {
        Instant earlier = Instant.parse("2026-11-26T10:00:00Z");
        Instant later = Instant.parse("2026-11-26T11:00:00Z");
        QuarkusTransaction.requiringNew().run(() -> {
            this.em.persist(new GameHighscore().game("breakout").userId("legacyHero")
                    .score(100).achievedAt(earlier).city(null));
            this.em.persist(new GameHighscore().game("breakout").userId("validUser")
                    .score(100).achievedAt(later).city(null));
        });

        given().when().get("/api/games/breakout/highscore")
                .then()
                .statusCode(200)
                .body("community.score", is(100))
                .body("community.userId", is("legacyHero"))
                .body("community.nickname", is("anonymous"));
    }

    @Test
    void missingNicknameFallsBackToAnonymous() {
        String token = register("tusrnoname", PASSWORD, "tusrnoname@example.test");

        submit(token, 80)
                .body("community.userId", is("tusrnoname"))
                .body("community.nickname", is("anonymous"));
    }

    @Test
    void optionalCityIsStoredForLaterUse() {
        String token = register("tusrgamecity", PASSWORD, "tusrgamecity@example.test", "City Hero");

        given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("{\"score\":10,\"city\":\"  München  \"}")
                .post("/api/games/breakout/highscore")
                .then()
                .statusCode(200)
                .body("personal.city", is("München"))
                .body("community.city", is("München"))
                .body("community.nickname", is("City Hero"));
    }

    private ValidatableResponse submit(String token, long score) {
        return given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("{\"score\":" + score + "}")
                .post("/api/games/breakout/highscore")
                .then()
                .statusCode(200);
    }
}
