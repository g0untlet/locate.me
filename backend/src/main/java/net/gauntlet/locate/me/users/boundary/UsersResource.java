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
        return Response.ok(this.currentUser.requireAuthenticated().toJSON()).build();
    }

    @PUT
    @Path("/me")
    @Authenticated
    @Transactional
    public Response updateMe(JsonObject json) {
        User target = this.currentUser.requireAuthenticated();
        return Response.ok(this.users.updateProfile(target, User.fromJson(json)).toJSON()).build();
    }

    @PUT
    @Path("/me/password")
    @Authenticated
    @Transactional
    public Response changePassword(JsonObject json) {
        this.users.changePassword(this.currentUser.requireAuthenticated(), User.fromJson(json));
        return Response.noContent().build();
    }

    @PUT
    @Path("/me/recovery-email")
    @Authenticated
    @Transactional
    public Response changeRecoveryEmail(JsonObject json) {
        this.users.changeRecoveryEmail(this.currentUser.requireAuthenticated(), User.fromJson(json));
        return Response.noContent().build();
    }

    @POST
    @RolesAllowed("ADMIN")
    @Transactional
    public Response create(JsonObject json) {
        User created = this.users.createByAdmin(adminInput(json));
        LOG.log(System.Logger.Level.DEBUG, "Administrator created user {0}", created.userId());
        return Response.created(URI.create("/api/users/" + created.userId()))
                .entity(created.toJSON())
                .build();
    }

    @GET
    @RolesAllowed("ADMIN")
    public Response list() {
        JsonArrayBuilder array = Json.createArrayBuilder();
        this.users.findAll().stream().map(User::toJSON).forEach(array::add);
        return Response.ok(array.build()).build();
    }

    @GET
    @Path("/{userId}")
    @RolesAllowed("ADMIN")
    public Response get(@PathParam("userId") String userId) {
        return Response.ok(this.users.requireByUserId(userId).toJSON()).build();
    }

    @PUT
    @Path("/{userId}")
    @RolesAllowed("ADMIN")
    @Transactional
    public Response update(@PathParam("userId") String userId, JsonObject json) {
        User target = this.users.requireByUserId(userId);
        return Response.ok(this.users.updateByAdmin(target, adminInput(json)).toJSON()).build();
    }

    @DELETE
    @Path("/{userId}")
    @RolesAllowed("ADMIN")
    @Transactional
    public Response delete(@PathParam("userId") String userId) {
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
