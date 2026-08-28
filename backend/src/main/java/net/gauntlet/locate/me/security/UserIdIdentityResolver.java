//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.security;

import io.quarkiverse.bucket4j.runtime.resolver.IdentityResolver;
import io.vertx.ext.web.RoutingContext;
import jakarta.inject.Inject;
import jakarta.enterprise.context.RequestScoped;

@RequestScoped
public class UserIdIdentityResolver implements IdentityResolver {

    @Inject
    RoutingContext routingContext;

    @Override
    public String getIdentityKey() {
        String userId = this.routingContext.request().getParam("userId");
        // Requests without a usable userId (e.g. floods of invalid IDs) share one
        // bounded bucket instead of creating a new bucket per unknown identity.
        return (userId == null || userId.isBlank()) ? "unknown" : userId;
    }
}
