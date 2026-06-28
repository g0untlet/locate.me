//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.system.boundary;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.gauntlet.locate.me.Boundary;
import net.gauntlet.locate.me.system.control.SystemInfo;

@Boundary
@Path("/system")
public class SystemBoundary {

    @Inject
    SystemInfo systemInfo;

    @GET
    @Path("/info")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getInfo() {
        return Response.ok(this.systemInfo.toJSON()).build();
    }
}
