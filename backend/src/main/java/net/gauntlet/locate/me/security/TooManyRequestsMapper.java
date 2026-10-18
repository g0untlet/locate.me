//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.security;

import io.quarkiverse.bucket4j.runtime.RateLimitException;
import io.vertx.ext.web.RoutingContext;
import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

@Provider
@Priority(Priorities.USER - 1)
public class TooManyRequestsMapper implements ExceptionMapper<RateLimitException> {

    static final System.Logger LOG = System.getLogger(TooManyRequestsMapper.class.getName());

    @Inject
    RoutingContext routingContext;

    @Override
    public Response toResponse(RateLimitException exception) {
        long retryAfterSeconds = Math.max(1, exception.getWaitTimeInMilliSeconds() / 1000);
        String userId = this.routingContext.request().getParam("userId");
        String method = this.routingContext.request().method().name();
        String path = this.routingContext.request().path();
        LOG.log(System.Logger.Level.INFO,
                "Rate limit exceeded for user {0}: {1} {2} – retry after {3}s",
                userId == null ? "unknown" : userId, method, path, retryAfterSeconds);

        return TooManyRequests.response(retryAfterSeconds);
    }
}
