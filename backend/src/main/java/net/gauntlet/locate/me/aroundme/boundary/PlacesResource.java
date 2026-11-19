//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.aroundme.boundary;

import java.util.List;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonArrayBuilder;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import io.quarkiverse.bucket4j.runtime.RateLimited;
import net.gauntlet.locate.me.Boundary;
import net.gauntlet.locate.me.aroundme.control.Geoboxing;
import net.gauntlet.locate.me.aroundme.control.Places;
import net.gauntlet.locate.me.aroundme.entity.Place;
import net.gauntlet.locate.me.security.AdminKeyVerifier;
import net.gauntlet.locate.me.users.control.CurrentUser;

@Boundary
@Path("/places")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PlacesResource {

    static final System.Logger LOG = System.getLogger(PlacesResource.class.getName());

    @Inject
    Places places;

    @Inject
    CurrentUser currentUser;

    @Inject
    AdminKeyVerifier adminKeyVerifier;

    private void validateCoordinates(Double lat, Double lon) {
        if (lat == null || lon == null) {
            throw new BadRequestException("Both lat and lon query parameters are required");
        }
        if (lat < -90.0 || lat > 90.0) {
            throw new BadRequestException("lat must be between -90 and 90");
        }
        if (lon < -180.0 || lon > 180.0) {
            throw new BadRequestException("lon must be between -180 and 180");
        }
    }

    @GET
    @Transactional
    @PermitAll
    @RateLimited(bucket = "pwa-standard")
    public Response getPlaces(
            @QueryParam("userId") String requestedUserId,
            @QueryParam("lat") Double lat,
            @QueryParam("lon") Double lon,
            @HeaderParam(HttpHeaders.ACCEPT_LANGUAGE) String acceptLanguage) {
        LOG.log(System.Logger.Level.DEBUG, "Received GET places request (lat={0}, lon={1})", lat, lon);
        this.currentUser.resolve(requestedUserId);
        validateCoordinates(lat, lon);

        List<Place> list = this.places.findNear(lat, lon, acceptLanguage);

        JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();
        list.stream()
            .map(place -> {
                double distance = Geoboxing.distanceMeters(lat, lon, place.latitude(), place.longitude());
                String direction = distance < 1.0
                        ? ""
                        : Geoboxing.compassPoint(Geoboxing.bearingDegrees(lat, lon, place.latitude(), place.longitude()));
                return Json.createObjectBuilder(place.toJSON())
                        .add("distance", distance)
                        .add("direction", direction)
                        .build();
            })
            .forEach(arrayBuilder::add);

        return Response.ok(arrayBuilder.build()).build();
    }

    @GET
    @Path("/stats")
    @PermitAll
    public Response countPlaces(@QueryParam("adminKey") String adminKey) {
        LOG.log(System.Logger.Level.DEBUG, "Received GET places-count stats request");
        this.adminKeyVerifier.verify(adminKey);

        JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();
        this.places.countByCity().stream()
                .map(count -> Json.createObjectBuilder()
                        .add("city", count.city())
                        .add("places", count.places())
                        .build())
                .forEach(arrayBuilder::add);
        return Response.ok(Json.createObjectBuilder()
                .add("count", this.places.count())
                .add("perCity", arrayBuilder)
                .build()).build();
    }
}
