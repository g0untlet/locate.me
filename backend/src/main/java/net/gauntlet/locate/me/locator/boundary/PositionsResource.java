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
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import net.gauntlet.locate.me.Boundary;
import net.gauntlet.locate.me.locator.control.DistanceCalculator;
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

    @Inject
    @ConfigProperty(name = "allowed.user.ids")
    List<String> allowedUserIds;

    private void validateAndAuthorize(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new BadRequestException("userId is mandatory");
        }
        if (userId.length() > 16) {
            throw new BadRequestException("userId must be at most 16 characters long");
        }
        if (!userId.matches("^[a-zA-Z0-9]+$")) {
            throw new BadRequestException("userId must be alphanumeric");
        }
        if (this.allowedUserIds == null || !this.allowedUserIds.contains(userId)) {
            Response errorResponse = Response.status(Response.Status.UNAUTHORIZED)
                    .entity(Json.createObjectBuilder()
                            .add("error", "User is not authorized: " + userId)
                            .build())
                    .type(MediaType.APPLICATION_JSON)
                    .build();
            throw new WebApplicationException(errorResponse);
        }
    }

    @POST
    @Transactional
    @PermitAll
    public Response create(@QueryParam("userId") String userId, JsonObject json) {
        LOG.log(System.Logger.Level.DEBUG, "Received POST request to create position");
        validateAndAuthorize(userId);
        if (json == null) {
            throw new BadRequestException("Request body must not be null");
        }
        Position position;
        try {
            position = Position.fromJSON(json);
        } catch (Exception e) {
            throw new BadRequestException("Invalid JSON format", e);
        }
        // Force validated userId from query parameter
        position.userId(userId);

        Set<ConstraintViolation<Position>> violations = this.validator.validate(position);
        if (!violations.isEmpty()) {
            LOG.log(System.Logger.Level.WARNING, "Validation failed for position creation");
            throw new BadRequestException("Validation failed: " + violations.iterator().next().getMessage());
        }

        Position created = this.positions.create(position, true);
        return Response.created(URI.create("/positions/" + created.id()))
                .entity(created.toJSON())
                .build();
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    @PermitAll
    public Response delete(@PathParam("id") Long id, @QueryParam("userId") String userId) {
        LOG.log(System.Logger.Level.DEBUG, "Received DELETE request for id {0} by user {1}", id, userId);
        validateAndAuthorize(userId);
        if (id == null) {
            throw new BadRequestException("ID must not be null");
        }
        this.positions.delete(id);
        return Response.noContent().build();
    }

    @GET
    @PermitAll
    public Response getPositions(
            @QueryParam("userId") String userId,
            @QueryParam("lat") Double lat,
            @QueryParam("lon") Double lon) {
        LOG.log(System.Logger.Level.DEBUG, "Received GET request for user {0} (lat={1}, lon={2})", userId, lat, lon);
        validateAndAuthorize(userId);
        List<Position> list = this.positions.findByUserId(userId);

        JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();
        
        final boolean calculateDistance = lat != null && lon != null;
        
        list.stream()
            .map(pos -> {
                JsonObject json = pos.toJSON();
                if (calculateDistance) {
                    double dist = DistanceCalculator.haversine(lat, lon, pos.latitude(), pos.longitude());
                    double walkingTime = DistanceCalculator.walkingTimeMinutes(dist);
                    return Json.createObjectBuilder(json)
                            .add("distance", dist)
                            .add("walkingTimeMinutes", walkingTime)
                            .build();
                }
                return json;
            })
            .forEach(arrayBuilder::add);

        return Response.ok(arrayBuilder.build()).build();
    }

    @GET
    @Path("/current")
    @PermitAll
    public Response fetchCurrentPosition(
            @QueryParam("userId") String userId,
            @QueryParam("lat") Double lat,
            @QueryParam("lon") Double lon) {
        LOG.log(System.Logger.Level.DEBUG, "Received GET current position request for user {0} (lat={1}, lon={2})", userId, lat, lon);
        validateAndAuthorize(userId);

        if(lat == null || lon == null) {
            throw new BadRequestException("Both lat and lon query parameters are required");
        }

        Position position;
        position = new Position();
        position.userId(userId);
        position.latitude(lat);
        position.longitude(lon);
        position.timestamp(java.time.Instant.now());

        Set<ConstraintViolation<Position>> violations = this.validator.validate(position);
        if (!violations.isEmpty()) {
            LOG.log(System.Logger.Level.WARNING, "Validation failed for position creation");
            throw new BadRequestException("Validation failed: " + violations.iterator().next().getMessage());
        }

        Position current = this.positions.create(position, false);
        return Response.ok(URI.create("/positions/current"))
                .entity(current.toJSON())
                .build();

    }

}
