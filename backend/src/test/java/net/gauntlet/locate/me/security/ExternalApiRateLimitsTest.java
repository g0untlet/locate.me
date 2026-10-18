//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.HttpHeaders;
import org.junit.jupiter.api.Test;

class ExternalApiRateLimitsTest {

    @Test
    void geoapifyBucketReturns429AfterConfiguredRequests() {
        ExternalApiRateLimits limits = limits(1, 10, 10);
        limits.acquireGeoapify();

        WebApplicationException error = catchThrowableOfType(limits::acquireGeoapify, WebApplicationException.class);

        assertRateLimited(error);
    }

    @Test
    void nominatimBucketReturns429AfterConfiguredRequests() {
        ExternalApiRateLimits limits = limits(10, 1, 10);
        limits.acquireNominatim();

        WebApplicationException error = catchThrowableOfType(limits::acquireNominatim, WebApplicationException.class);

        assertRateLimited(error);
    }

    @Test
    void weatherBucketReturns429AfterConfiguredRequests() {
        ExternalApiRateLimits limits = limits(10, 10, 1);
        limits.acquireWeather();

        WebApplicationException error = catchThrowableOfType(limits::acquireWeather, WebApplicationException.class);

        assertRateLimited(error);
    }

    private void assertRateLimited(WebApplicationException error) {
        assertThat(error).isNotNull();
        assertThat(error.getResponse().getStatus()).isEqualTo(429);
        assertThat(error.getResponse().getHeaderString(HttpHeaders.RETRY_AFTER)).isNotBlank();
    }

    private ExternalApiRateLimits limits(int geoapifyRequests, int nominatimRequests, int weatherRequests) {
        ExternalApiRateLimits limits = new ExternalApiRateLimits();
        limits.geoapifyRequests = geoapifyRequests;
        limits.geoapifyPeriodSeconds = 3600;
        limits.nominatimRequests = nominatimRequests;
        limits.nominatimPeriodSeconds = 3600;
        limits.weatherRequests = weatherRequests;
        limits.weatherPeriodSeconds = 3600;
        limits.maxWaitSeconds = 0;
        limits.init();
        return limits;
    }
}
