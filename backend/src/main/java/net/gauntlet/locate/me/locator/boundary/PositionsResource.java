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
import io.quarkiverse.bucket4j.runtime.RateLimited;
import net.gauntlet.locate.me.Boundary;
import net.gauntlet.locate.me.locator.control.DistanceCalculator;
import net.gauntlet.locate.me.locator.control.Positions;
import net.gauntlet.locate.me.locator.entity.Position;
import net.gauntlet.locate.me.security.AdminKeyVerifier;
import net.gauntlet.locate.me.users.control.CurrentUser;

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
    CurrentUser currentUser;

    @Inject
    AdminKeyVerifier adminKeyVerifier;

    @POST
    @Transactional
    @PermitAll
    @RateLimited(bucket = "pwa-critical")
    public Response create(@QueryParam("userId") String requestedUserId, JsonObject json) {
        LOG.log(System.Logger.Level.DEBUG, "Received POST request to create position");
        String userId = this.currentUser.resolve(requestedUserId);
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
        // A new position is created server-side; never accept a client-supplied id
        position.id(null);

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
    @RateLimited(bucket = "pwa-critical")
    public Response delete(@PathParam("id") Long id, @QueryParam("userId") String requestedUserId) {
        LOG.log(System.Logger.Level.DEBUG, "Received DELETE request for id {0}", id);
        String userId = this.currentUser.resolve(requestedUserId);
        if (id == null) {
            throw new BadRequestException("ID must not be null");
        }
        this.positions.delete(id, userId);
        return Response.noContent().build();
    }

    @GET
    @PermitAll
    @RateLimited(bucket = "pwa-standard")
    public Response getPositions(
            @QueryParam("userId") String requestedUserId,
            @QueryParam("lat") Double lat,
            @QueryParam("lon") Double lon) {
        LOG.log(System.Logger.Level.DEBUG, "Received GET request (lat={0}, lon={1})", lat, lon);
        String userId = this.currentUser.resolve(requestedUserId);
        List<Position> list = this.positions.findByUserId(userId);

        JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();
        
        final boolean calculateDistance = lat != null && lon != null;
        
        list.stream()
            .map(pos -> calculateDistance
                    ? enrichWithTravelTimes(pos, lat, lon)
                    : pos.toJSON())
            .forEach(arrayBuilder::add);

        return Response.ok(arrayBuilder.build()).build();
    }

    @GET
    @Path("/stats")
    @PermitAll
    public Response countPositionsPerUser(@QueryParam("adminKey") String adminKey) {
        LOG.log(System.Logger.Level.DEBUG, "Received GET positions-per-user stats request");
        this.adminKeyVerifier.verify(adminKey);

        List<Positions.PositionCount> counts = this.positions.countByUser();
        long total = counts.stream().mapToLong(Positions.PositionCount::locations).sum();

        JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();
        counts.stream()
                .map(count -> Json.createObjectBuilder()
                        .add("userId", count.userId())
                        .add("locations", count.locations())
                        .build())
                .forEach(arrayBuilder::add);
        return Response.ok(Json.createObjectBuilder()
                .add("total", total)
                .add("perUser", arrayBuilder)
                .build()).build();
    }

    private JsonObject enrichWithTravelTimes(Position position, double lat, double lon) {
        double distanceKm = DistanceCalculator.haversine(lat, lon, position.latitude(), position.longitude());
        return Json.createObjectBuilder(position.toJSON())
                .add("distance", distanceKm)
                .add("walkingTimeMinutes", DistanceCalculator.walkingTimeMinutes(distanceKm))
                .add("bikingTimeMinutes", DistanceCalculator.bikingTimeMinutes(distanceKm))
                .add("drivingTimeMinutes", DistanceCalculator.drivingTimeMinutes(distanceKm))
                .build();
    }

    @GET
    @Path("/current")
    @PermitAll
    @RateLimited(bucket = "pwa-standard")
    public Response fetchCurrentPosition(
            @QueryParam("userId") String requestedUserId,
            @QueryParam("lat") Double lat,
            @QueryParam("lon") Double lon) {
        LOG.log(System.Logger.Level.DEBUG, "Received GET current position request (lat={0}, lon={1})", lat, lon);
        String userId = this.currentUser.resolve(requestedUserId);

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

        Positions.Current current = this.positions.enrich(position);
        return Response.ok(URI.create("/positions/current"))
                .entity(current.toJSON())
                .build();

    }

}
