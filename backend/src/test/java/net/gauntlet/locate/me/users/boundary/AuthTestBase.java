//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.boundary;

import static io.restassured.RestAssured.given;

import java.util.List;
import java.util.Locale;
import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonObjectBuilder;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.restassured.http.ContentType;
import net.gauntlet.locate.me.users.entity.UserStatus;

/**
 * Shared setup for the authentication/system-test integration suite.
 *
 * <p>All authentication integration tests share the in-memory test database, so
 * every test starts from a known state: positions and test-created accounts are
 * removed and the bootstrapped legacy accounts are reset to "unmigrated".
 */
public abstract class AuthTestBase {

    public static final String PASSWORD = "correct-horse-123";

    public static final String ADMIN_PASSWORD = "admin-password-123";

    static final String TEST_USER_PREFIX = "tusr%";

    static final List<String> LEGACY_USERS = List.of(
            "validuser", "noaccuracyuser", "geouser", "geofailuser", "stuser", "legacyhero", "adminuser");

    @Inject
    public EntityManager em;

    @BeforeEach
    public void resetDatabase() {
        QuarkusTransaction.requiringNew().run(this::resetInTransaction);
    }

    void resetInTransaction() {
        this.em.createQuery("DELETE FROM Position").executeUpdate();
        this.em.createQuery("DELETE FROM User u WHERE u.userIdLower LIKE :prefix")
                .setParameter("prefix", TEST_USER_PREFIX)
                .executeUpdate();
        this.em.createQuery("UPDATE User u SET u.passwordHash = NULL, u.email = NULL, u.status = :active, "
                        + "u.failedLoginAttempts = 0, u.lockedUntil = NULL, u.lastLoginAt = NULL "
                        + "WHERE u.userIdLower IN :ids")
                .setParameter("active", UserStatus.ACTIVE)
                .setParameter("ids", LEGACY_USERS)
                .executeUpdate();
    }

    public String register(String userId, String password, String email) {
        return given().contentType(ContentType.JSON)
                .body(credentials(userId, password, email))
                .post("/api/auth/register")
                .then()
                .log().ifValidationFails()
                .statusCode(201)
                .extract().path("token");
    }

    public String claim(String userId, String password, String email) {
        return given().contentType(ContentType.JSON)
                .body(credentials(userId, password, email))
                .post("/api/auth/claim")
                .then()
                .log().ifValidationFails()
                .statusCode(200)
                .extract().path("token");
    }

    public String login(String userId, String password) {
        return given().contentType(ContentType.JSON)
                .body(credentials(userId, password, null))
                .post("/api/auth/login")
                .then()
                .statusCode(200)
                .extract().path("token");
    }

    /**
     * The bootstrapped {@code adminUser} account is claimed here, which also
     * proves that a legacy migration preserves the ADMIN role granted by the
     * administrative bootstrap.
     */
    public String adminToken() {
        return claim("adminUser", ADMIN_PASSWORD, "admin@example.test");
    }

    public void disable(String userId) {
        QuarkusTransaction.requiringNew().run(() -> this.em.createQuery(
                        "UPDATE User u SET u.status = :status WHERE u.userIdLower = :id")
                .setParameter("status", UserStatus.DISABLED)
                .setParameter("id", userId.toLowerCase(Locale.ROOT))
                .executeUpdate());
    }

    public static String credentials(String userId, String password, String email) {
        JsonObjectBuilder builder = Json.createObjectBuilder();
        if (userId != null) {
            builder.add("userId", userId);
        }
        if (password != null) {
            builder.add("password", password);
        }
        if (email != null) {
            builder.add("email", email);
        }
        return builder.build().toString();
    }
}
