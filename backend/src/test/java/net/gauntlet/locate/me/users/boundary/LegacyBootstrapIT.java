//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.boundary;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.CoreMatchers.is;

import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;
import io.quarkus.test.junit.QuarkusTest;
import net.gauntlet.locate.me.users.control.LegacyUsers;

@QuarkusTest
class LegacyBootstrapIT extends AuthTestBase {

    @Inject
    LegacyUsers legacyUsers;

    @Test
    void importedLegacyAccountsStartUnmigrated() {
        given().when().get("/api/auth/migration-status/legacyHero")
                .then()
                .statusCode(200)
                .body("migrationRequired", is(true));

        given().when().get("/api/auth/migration-status/validUser")
                .then()
                .statusCode(200)
                .body("migrationRequired", is(true));
    }

    @Test
    void repeatedBootstrapDoesNotCreateDuplicatesOrOverwriteAMigratedAccount() {
        String token = claim("legacyHero", PASSWORD, "legacyhero@example.test");

        this.legacyUsers.reconcile();

        long count = this.em.createQuery(
                        "SELECT COUNT(u) FROM User u WHERE u.userIdLower = :id", Long.class)
                .setParameter("id", "legacyhero")
                .getSingleResult();
        assertThat(count).isEqualTo(1);

        // The password hash and recovery email survived the reconciliation.
        given().auth().oauth2(token)
                .when().get("/api/users/me")
                .then()
                .statusCode(200)
                .body("userId", is("legacyHero"))
                .body("email", is("legacyhero@example.test"));

        given().contentType("application/json")
                .body(credentials("legacyHero", PASSWORD, null))
                .post("/api/auth/login")
                .then().statusCode(200);
    }
}
