//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.boundary;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import net.gauntlet.locate.me.Boundary;
import net.gauntlet.locate.me.security.AuthErrors;
import net.gauntlet.locate.me.security.AuthRateLimits;
import net.gauntlet.locate.me.security.LogValues;
import net.gauntlet.locate.me.users.control.DemoUserPolicy;
import net.gauntlet.locate.me.users.control.JwtTokens;
import net.gauntlet.locate.me.users.control.UserAccounts;
import net.gauntlet.locate.me.users.control.UserIds;
import net.gauntlet.locate.me.users.entity.User;
import net.gauntlet.locate.me.users.entity.UserStatus;

/**
 * Public authentication surface: registration, legacy migration, login and the
 * migration status probe. Password recovery is deliberately not implemented
 * yet; both endpoints exist so the frontend contract is stable.
 */
@Boundary
@Path("/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthResource {

    static final System.Logger LOG = System.getLogger(AuthResource.class.getName());

    @Inject
    UserAccounts users;

    @Inject
    JwtTokens tokens;

    @Inject
    UserIds userIds;

    @Inject
    AuthRateLimits rateLimits;

    /**
     * Operational gate for the one-time legacy claim. Claim is the only public
     * path that turns a known legacy id into an account, so a deployment can sit
     * in PROD with it disabled until the frontend migration UI is live.
     */
    @ConfigProperty(name = "auth.claim.enabled", defaultValue = "true")
    boolean claimEnabled;

    @POST
    @Path("/register")
    @PermitAll
    @Transactional
    public Response register(JsonObject json) {
        User input = User.fromJson(json);
        LOG.log(System.Logger.Level.INFO, "POST /api/auth/register userId={0}", LogValues.safe(input.userId()));
        this.rateLimits.checkRegistration();
        User created = this.users.register(input);
        return tokenResponse(Response.Status.CREATED, created);
    }

    @POST
    @Path("/login")
    @PermitAll
    public Response login(JsonObject json) {
        User input = User.fromJson(json);
        LOG.log(System.Logger.Level.INFO, "POST /api/auth/login userId={0}", LogValues.safe(input.userId()));
        this.rateLimits.checkLogin();
        User user = this.users.authenticate(input);
        return tokenResponse(Response.Status.OK, user);
    }

    @POST
    @Path("/claim")
    @PermitAll
    @Transactional
    public Response claim(JsonObject json) {
        User input = User.fromJson(json);
        LOG.log(System.Logger.Level.INFO, "POST /api/auth/claim userId={0}", LogValues.safe(input.userId()));
        if (!this.claimEnabled) {
            throw AuthErrors.serviceUnavailable("Account migration is temporarily disabled");
        }
        this.rateLimits.checkClaim(input.userId());
        User migrated = this.users.claim(input);
        return tokenResponse(Response.Status.OK, migrated);
    }

    /**
     * Returns only the minimum needed by the frontend to start the one-time
     * migration: never user details, roles, recovery data or business data. An
     * unknown identifier reports {@code false} like every non-migratable one.
     */
    @GET
    @Path("/migration-status/{userId}")
    @PermitAll
    public Response migrationStatus(@PathParam("userId") String userId) {
        this.rateLimits.checkMigrationStatus(userId);
        String lookup = this.userIds.normalizeForLookup(userId);
        boolean required = lookup != null && this.users.findByUserId(lookup)
                .filter(user -> !DemoUserPolicy.isDemo(user.userId()))
                .filter(user -> user.status() == UserStatus.ACTIVE)
                .filter(user -> user.passwordHash() == null)
                .isPresent();
        LOG.log(System.Logger.Level.INFO,
                "GET /api/auth/migration-status userId={0} migrationRequired={1}",
                LogValues.safe(userId), required);
        return Response.ok(Json.createObjectBuilder()
                .add("migrationRequired", required)
                .build()).build();
    }

    @POST
    @Path("/password-reset/request")
    @PermitAll
    public Response requestPasswordReset(JsonObject json) {
        User input = User.fromJson(json);
        LOG.log(System.Logger.Level.INFO,
                "POST /api/auth/password-reset/request userId={0} (not implemented)",
                LogValues.safe(input.userId()));
        return passwordResetNotImplemented();
    }

    @POST
    @Path("/password-reset/confirm")
    @PermitAll
    public Response confirmPasswordReset(JsonObject json) {
        LOG.log(System.Logger.Level.INFO, "POST /api/auth/password-reset/confirm (not implemented)");
        return passwordResetNotImplemented();
    }

    private Response passwordResetNotImplemented() {
        return Response.status(Response.Status.NOT_IMPLEMENTED)
                .entity(Json.createObjectBuilder()
                        .add("error", "Password reset is not available yet")
                        .build())
                .build();
    }

    private Response tokenResponse(Response.Status status, User user) {
        JwtTokens.IssuedToken issued = this.tokens.issue(user);
        return Response.status(status)
                .entity(Json.createObjectBuilder()
                        .add("token", issued.token())
                        .add("tokenType", "Bearer")
                        .add("userId", user.userId())
                        .add("expiresAt", issued.expiresAt().toString())
                        .build())
                .build();
    }
}
