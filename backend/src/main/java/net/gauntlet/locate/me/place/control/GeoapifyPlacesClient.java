//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.place.control;

import jakarta.json.JsonObject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

@Path("/v2/places")
@RegisterRestClient(configKey = "geoapify_uri")
@Produces(MediaType.APPLICATION_JSON)
public interface GeoapifyPlacesClient {

    @GET
    JsonObject places(
            @QueryParam("categories") String categories,
            @QueryParam("filter") String filter,
            @QueryParam("bias") String bias,
            @QueryParam("limit") int limit,
            @QueryParam("format") String format,
            @QueryParam("apiKey") String apiKey);
}
