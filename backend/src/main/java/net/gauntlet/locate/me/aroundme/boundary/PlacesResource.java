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
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import net.gauntlet.locate.me.Boundary;
import net.gauntlet.locate.me.aroundme.control.Geoboxing;
import net.gauntlet.locate.me.aroundme.control.Places;
import net.gauntlet.locate.me.aroundme.entity.Place;

@Boundary
@Path("/places")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PlacesResource {

    static final System.Logger LOG = System.getLogger(PlacesResource.class.getName());

    @Inject
    Places places;

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
    public Response getPlaces(
            @QueryParam("userId") String userId,
            @QueryParam("lat") Double lat,
            @QueryParam("lon") Double lon,
            @HeaderParam(HttpHeaders.ACCEPT_LANGUAGE) String acceptLanguage) {
        LOG.log(System.Logger.Level.DEBUG, "Received GET places request for user {0} (lat={1}, lon={2})", userId, lat, lon);
        validateAndAuthorize(userId);
        validateCoordinates(lat, lon);

        List<Place> list = this.places.findNear(lat, lon, acceptLanguage);

        JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();
        list.stream()
            .map(place -> Json.createObjectBuilder(place.toJSON())
                    .add("distance", Geoboxing.distanceMeters(lat, lon, place.latitude(), place.longitude()))
                    .build())
            .forEach(arrayBuilder::add);

        return Response.ok(arrayBuilder.build()).build();
    }
}
