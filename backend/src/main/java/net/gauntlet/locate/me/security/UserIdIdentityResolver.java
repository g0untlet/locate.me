//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.security;

import io.quarkiverse.bucket4j.runtime.resolver.IdentityResolver;
import io.quarkus.security.identity.SecurityIdentity;
import io.vertx.core.net.SocketAddress;
import io.vertx.ext.web.RoutingContext;
import jakarta.inject.Inject;
import jakarta.enterprise.context.RequestScoped;
import net.gauntlet.locate.me.users.control.DemoUserPolicy;

/**
 * Identity key for the per-user Bucket4j buckets.
 *
 * <p>An authenticated request is keyed by the verified token subject. The
 * shared demo user is keyed by client address so its stricter unauthenticated
 * access cannot exhaust a single global bucket. Everything else falls back to
 * the legacy {@code userId} query parameter, with one bounded bucket for
 * missing or blank ids.
 */
@RequestScoped
public class UserIdIdentityResolver implements IdentityResolver {

    @Inject
    RoutingContext routingContext;

    @Inject
    SecurityIdentity identity;

    @Override
    public String getIdentityKey() {
        if (!this.identity.isAnonymous() && this.identity.getPrincipal() != null) {
            String subject = this.identity.getPrincipal().getName();
            if (subject != null && !subject.isBlank()) {
                return subject;
            }
        }
        String userId = this.routingContext.request().getParam("userId");
        if (DemoUserPolicy.isDemo(userId)) {
            return "demo:" + clientAddress();
        }
        return (userId == null || userId.isBlank()) ? "unknown" : userId;
    }

    private String clientAddress() {
        SocketAddress address = this.routingContext.request().remoteAddress();
        return address != null && address.host() != null ? address.host() : "unknown";
    }
}
