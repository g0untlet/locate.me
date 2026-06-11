//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package main.java.net.gauntlet.locate.me.locator;

import jakarta.json.JsonObject;
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
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

@Path("/positions")
@RegisterRestClient(configKey = "service_uri")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface PositionsResourceClient {

    @POST
    Response create(JsonObject json);

    @DELETE
    @Path("/{id}")
    Response delete(@PathParam("id") Long id);

    @GET
    Response getPositions(@QueryParam("userId") String userId);
}
