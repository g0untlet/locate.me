//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.control;

import jakarta.json.JsonObject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.rest.client.annotation.ClientHeaderParam;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

@Path("/reverse")
@RegisterRestClient(configKey = "nominatim_uri")
@Produces(MediaType.APPLICATION_JSON)
@ClientHeaderParam(name = "User-Agent", value = "LocateMeApp/1.0 (internal@local.me)")
public interface GeocodingClient {

    @GET
    JsonObject reverse(
            @QueryParam("lat") double latitude,
            @QueryParam("lon") double longitude,
            @QueryParam("format") String format);
}
