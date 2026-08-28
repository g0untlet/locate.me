//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Guards the admin DB-monitoring endpoints. The presented adminKey query
 * parameter is checked against the configured admin.key (env-var overridable)
 * with a constant-time comparison; a missing, blank or mismatched key yields
 * 401 Unauthorized.
 */
@RequestScoped
public class AdminKeyVerifier {

    @Inject
    @ConfigProperty(name = "admin.key")
    String adminKey;

    public void verify(String presentedKey) {
        if (!matches(presentedKey)) {
            throw new WebApplicationException(Response.status(Response.Status.UNAUTHORIZED)
                    .entity(Json.createObjectBuilder().add("error", "Invalid admin key").build())
                    .type(MediaType.APPLICATION_JSON)
                    .build());
        }
    }

    private boolean matches(String presentedKey) {
        if (this.adminKey == null || this.adminKey.isBlank() || presentedKey == null) {
            return false;
        }
        byte[] expected = this.adminKey.getBytes(StandardCharsets.UTF_8);
        byte[] actual = presentedKey.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expected, actual);
    }
}
