//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.security;

import jakarta.json.Json;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * Builds the JSON error responses of the authentication and user endpoints, so
 * the frontend sees the same {@code {"error": "..."}} shape everywhere.
 *
 * <p>Messages must stay generic where they could disclose whether an account
 * exists or has already been migrated; callers decide what is safe to say.
 */
public final class AuthErrors {

    private AuthErrors() {
    }

    public static WebApplicationException badRequest(String message) {
        return error(Response.Status.BAD_REQUEST, message);
    }

    public static WebApplicationException unauthorized(String message) {
        return error(Response.Status.UNAUTHORIZED, message);
    }

    public static WebApplicationException forbidden(String message) {
        return error(Response.Status.FORBIDDEN, message);
    }

    public static WebApplicationException notFound(String message) {
        return error(Response.Status.NOT_FOUND, message);
    }

    public static WebApplicationException conflict(String message) {
        return error(Response.Status.CONFLICT, message);
    }

    public static WebApplicationException serviceUnavailable(String message) {
        return error(Response.Status.SERVICE_UNAVAILABLE, message);
    }

    private static WebApplicationException error(Response.Status status, String message) {
        return new WebApplicationException(Response.status(status)
                .entity(Json.createObjectBuilder().add("error", message).build())
                .type(MediaType.APPLICATION_JSON)
                .build());
    }
}
