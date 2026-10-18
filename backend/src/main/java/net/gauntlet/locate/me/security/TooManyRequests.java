//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.security;

import jakarta.json.Json;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * Builds the shared 429 response used by both the per-user PWA rate limiter and
 * the global external-API rate limiter.
 */
public final class TooManyRequests {

    private TooManyRequests() {
    }

    public static Response response(long retryAfterSeconds) {
        return Response.status(Response.Status.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, retryAfterSeconds)
                .type(MediaType.APPLICATION_JSON)
                .entity(Json.createObjectBuilder()
                        .add("error", "TOO_MANY_REQUESTS")
                        .add("status", 429)
                        .build())
                .build();
    }

    public static WebApplicationException exception(long retryAfterSeconds) {
        return new WebApplicationException(response(retryAfterSeconds));
    }
}
