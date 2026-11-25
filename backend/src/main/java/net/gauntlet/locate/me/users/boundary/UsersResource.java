//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.boundary;

import java.net.URI;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonObject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.gauntlet.locate.me.Boundary;
import net.gauntlet.locate.me.security.LogValues;
import net.gauntlet.locate.me.users.control.CurrentUser;
import net.gauntlet.locate.me.users.control.UserAccounts;
import net.gauntlet.locate.me.users.entity.User;

/**
 * Self-service and administrative account operations.
 *
 * <p>Self-service requires a bearer token and derives the identity exclusively
 * from the verified token; the request body can never change the userId,
 * recovery email, roles, status or security state through the general profile
 * update. Administrative operations require the ADMIN role.
 */
@Boundary
@Path("/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UsersResource {

    static final System.Logger LOG = System.getLogger(UsersResource.class.getName());

    @Inject
    CurrentUser currentUser;

    @Inject
    UserAccounts users;

    @GET
    @Path("/me")
    @Authenticated
    public Response me() {
        User user = this.currentUser.requireAuthenticated();
        LOG.log(System.Logger.Level.INFO, "GET /api/users/me userId={0}", user.userId());
        return Response.ok(user.toJSON()).build();
    }

    @PUT
    @Path("/me")
    @Authenticated
    @Transactional
    public Response updateMe(JsonObject json) {
        User target = this.currentUser.requireAuthenticated();
        LOG.log(System.Logger.Level.INFO, "PUT /api/users/me userId={0}", target.userId());
        return Response.ok(this.users.updateProfile(target, User.fromJson(json)).toJSON()).build();
    }

    @PUT
    @Path("/me/password")
    @Authenticated
    @Transactional
    public Response changePassword(JsonObject json) {
        User target = this.currentUser.requireAuthenticated();
        LOG.log(System.Logger.Level.INFO, "PUT /api/users/me/password userId={0}", target.userId());
        this.users.changePassword(target, User.fromJson(json));
        return Response.noContent().build();
    }

    @PUT
    @Path("/me/recovery-email")
    @Authenticated
    @Transactional
    public Response changeRecoveryEmail(JsonObject json) {
        User target = this.currentUser.requireAuthenticated();
        LOG.log(System.Logger.Level.INFO, "PUT /api/users/me/recovery-email userId={0}", target.userId());
        this.users.changeRecoveryEmail(target, User.fromJson(json));
        return Response.noContent().build();
    }

    @POST
    @RolesAllowed("ADMIN")
    @Transactional
    public Response create(JsonObject json) {
        User admin = this.currentUser.requireAuthenticated();
        User input = adminInput(json);
        LOG.log(System.Logger.Level.INFO,
                "POST /api/users admin={0} target={1}", admin.userId(), LogValues.safe(input.userId()));
        User created = this.users.createByAdmin(input);
        return Response.created(URI.create("/api/users/" + created.userId()))
                .entity(created.toJSON())
                .build();
    }

    @GET
    @RolesAllowed("ADMIN")
    public Response list() {
        User admin = this.currentUser.requireAuthenticated();
        LOG.log(System.Logger.Level.INFO, "GET /api/users admin={0}", admin.userId());
        JsonArrayBuilder array = Json.createArrayBuilder();
        this.users.findAll().stream().map(User::toJSON).forEach(array::add);
        return Response.ok(array.build()).build();
    }

    @GET
    @Path("/{userId}")
    @RolesAllowed("ADMIN")
    public Response get(@PathParam("userId") String userId) {
        User admin = this.currentUser.requireAuthenticated();
        LOG.log(System.Logger.Level.INFO,
                "GET /api/users/{0} admin={1}", LogValues.safe(userId), admin.userId());
        return Response.ok(this.users.requireByUserId(userId).toJSON()).build();
    }

    @PUT
    @Path("/{userId}")
    @RolesAllowed("ADMIN")
    @Transactional
    public Response update(@PathParam("userId") String userId, JsonObject json) {
        User admin = this.currentUser.requireAuthenticated();
        LOG.log(System.Logger.Level.INFO,
                "PUT /api/users/{0} admin={1}", LogValues.safe(userId), admin.userId());
        User target = this.users.requireByUserId(userId);
        return Response.ok(this.users.updateByAdmin(target, adminInput(json)).toJSON()).build();
    }

    /**
     * Administrative password reset (support path when a user forgot the
     * password or lost the recovery email). Deliberately separate from the
     * general update: a password is never changed through {@code PUT /users/{userId}}.
     */
    @PUT
    @Path("/{userId}/password")
    @RolesAllowed("ADMIN")
    @Transactional
    public Response resetPassword(@PathParam("userId") String userId, JsonObject json) {
        User admin = this.currentUser.requireAuthenticated();
        LOG.log(System.Logger.Level.INFO,
                "PUT /api/users/{0}/password admin={1}", LogValues.safe(userId), admin.userId());
        User target = this.users.requireByUserId(userId);
        this.users.resetPassword(target, User.fromJson(json));
        return Response.noContent().build();
    }

    @DELETE
    @Path("/{userId}")
    @RolesAllowed("ADMIN")
    @Transactional
    public Response delete(@PathParam("userId") String userId) {
        User admin = this.currentUser.requireAuthenticated();
        LOG.log(System.Logger.Level.INFO,
                "DELETE /api/users/{0} admin={1}", LogValues.safe(userId), admin.userId());
        this.users.deactivate(this.users.requireByUserId(userId));
        return Response.noContent().build();
    }

    private User adminInput(JsonObject json) {
        try {
            return User.fromAdminJson(json);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid status or role");
        }
    }
}
