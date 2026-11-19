//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.control;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.json.JsonNumber;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;
import net.gauntlet.locate.me.Control;
import net.gauntlet.locate.me.security.AuthErrors;
import net.gauntlet.locate.me.security.AuthRateLimits;
import net.gauntlet.locate.me.users.entity.User;
import net.gauntlet.locate.me.users.entity.UserStatus;

/**
 * Resolves the identity of a request.
 *
 * <p>A bearer token wins: the userId always comes from the verified {@code sub}
 * claim and the client-supplied query parameter is ignored. Without a token the
 * existing business endpoints keep working for the transition in two cases
 * only: the exact shared demo user, and a not-yet-migrated legacy account when
 * {@code auth.legacy-userid-auth} is enabled. A migrated account (password set)
 * must use its token.
 */
@Control
public class CurrentUser {

    @Inject
    SecurityIdentity identity;

    @Inject
    JsonWebToken jsonWebToken;

    @Inject
    UserAccounts users;

    @Inject
    AuthRateLimits rateLimits;

    @ConfigProperty(name = "auth.legacy-userid-auth", defaultValue = "true")
    boolean legacyUseridAuth;

    /**
     * Legacy-compatible resolution used by the position and place endpoints
     * while the frontend still sends {@code ?userId=}.
     */
    public String resolve(String queryUserId) {
        if (isAuthenticated()) {
            return requireActiveTokenUser().userId();
        }
        requireLegacyFormat(queryUserId);
        if (DemoUserPolicy.isDemo(queryUserId)) {
            this.rateLimits.checkDemo();
            return queryUserId;
        }
        if (!this.legacyUseridAuth) {
            throw AuthErrors.unauthorized("User is not authorized");
        }
        User user = this.users.findByUserId(queryUserId)
                .orElseThrow(() -> AuthErrors.unauthorized("User is not authorized"));
        if (user.passwordHash() != null || user.status() != UserStatus.ACTIVE) {
            throw AuthErrors.unauthorized("User is not authorized");
        }
        return user.userId();
    }

    /**
     * Strict resolution for the self-service endpoints: a valid, active account
     * is mandatory and there is no demo or legacy exception.
     */
    public User requireAuthenticated() {
        if (!isAuthenticated()) {
            throw AuthErrors.unauthorized("Authentication required");
        }
        return requireActiveTokenUser();
    }

    public boolean isAuthenticated() {
        return !this.identity.isAnonymous() && this.identity.getPrincipal() != null;
    }

    User requireActiveTokenUser() {
        String userId = this.jsonWebToken.getSubject();
        if (userId == null || userId.isBlank()) {
            throw AuthErrors.unauthorized("Authentication required");
        }
        User user = this.users.findByUserId(userId)
                .orElseThrow(() -> AuthErrors.unauthorized("Authentication required"));
        if (user.status() != UserStatus.ACTIVE || tokenEpoch() != user.authEpoch()) {
            throw AuthErrors.unauthorized("Authentication required");
        }
        return user;
    }

    /**
     * Credential generation carried by the token. A password change or an
     * administrative reset increments the account's generation, so tokens from
     * before the change no longer match. Missing claims (tokens from a future
     * or foreign issuer) are rejected rather than treated as generation 0.
     */
    long tokenEpoch() {
        Object claim = this.jsonWebToken.getClaim("ver");
        // Parsed JSON numbers arrive as JsonNumber (Parsson), not java.lang.Number.
        if (claim instanceof Number number) {
            return number.longValue();
        }
        if (claim instanceof JsonNumber number) {
            return number.longValue();
        }
        return -1L;
    }

    /**
     * Preserves the former public contract of the business endpoints (400 for a
     * missing or malformed id, 401 for an unknown one). New registrations may use
     * characters that this legacy format does not allow; those users authenticate
     * with a bearer token instead.
     */
    void requireLegacyFormat(String queryUserId) {
        if (queryUserId == null || queryUserId.isBlank()) {
            throw AuthErrors.badRequest("userId is mandatory");
        }
        if (queryUserId.length() > 16) {
            throw AuthErrors.badRequest("userId must be at most 16 characters long");
        }
        if (!queryUserId.matches("^[a-zA-Z0-9]+$")) {
            throw AuthErrors.badRequest("userId must be alphanumeric");
        }
    }
}
