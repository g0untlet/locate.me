//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.boundary;

import java.net.URI;
import java.util.List;
import java.util.Set;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonObject;
import jakarta.transaction.Transactional;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.gauntlet.locate.me.Boundary;
import net.gauntlet.locate.me.locator.control.Positions;
import net.gauntlet.locate.me.locator.entity.Position;

@Boundary
@Path("/positions")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PositionsResource {

    static final System.Logger LOG = System.getLogger(PositionsResource.class.getName());

    @Inject
    Positions positions;

    @Inject
    Validator validator;

    @POST
    @Transactional
    @PermitAll
    public Response create(JsonObject json) {
        LOG.log(System.Logger.Level.DEBUG, "Received POST request to create position");
        if (json == null) {
            throw new BadRequestException("Request body must not be null");
        }
        Position position;
        try {
            position = Position.fromJSON(json);
        } catch (Exception e) {
            throw new BadRequestException("Invalid JSON format", e);
        }

        Set<ConstraintViolation<Position>> violations = this.validator.validate(position);
        if (!violations.isEmpty()) {
            LOG.log(System.Logger.Level.WARNING, "Validation failed for position creation");
            throw new BadRequestException("Validation failed: " + violations.iterator().next().getMessage());
        }

        Position created = this.positions.create(position);
        return Response.created(URI.create("/positions/" + created.id()))
                .entity(created.toJSON())
                .build();
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    @PermitAll
    public Response delete(@PathParam("id") Long id) {
        LOG.log(System.Logger.Level.DEBUG, "Received DELETE request for id {0}", id);
        if (id == null) {
            throw new BadRequestException("ID must not be null");
        }
        this.positions.delete(id);
        return Response.noContent().build();
    }

    @GET
    @PermitAll
    public Response getPositions(@QueryParam("userId") String userId) {
        LOG.log(System.Logger.Level.DEBUG, "Received GET request for user {0}", userId);
        List<Position> list;
        if (userId != null && !userId.isBlank()) {
            list = this.positions.findByUserId(userId);
        } else {
            list = this.positions.findAll();
        }

        JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();
        list.stream()
            .map(Position::toJSON)
            .forEach(arrayBuilder::add);

        return Response.ok(arrayBuilder.build()).build();
    }
}
