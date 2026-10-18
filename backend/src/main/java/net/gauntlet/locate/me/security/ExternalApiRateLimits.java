//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.security;

import java.time.Duration;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Global token buckets protecting the external APIs called by the backend.
 *
 * These limits are intentionally not per user: the external services enforce
 * quotas per API key or source IP, so all users share the same buckets. A short
 * blocking wait absorbs legitimate bursts (e.g. one Geoapify call per category
 * group); if the wait is exhausted the request is rejected with the standard
 * 429 response.
 */
@ApplicationScoped
public class ExternalApiRateLimits {

    static final System.Logger LOG = System.getLogger(ExternalApiRateLimits.class.getName());

    @ConfigProperty(name = "external-api.geoapify.requests", defaultValue = "2")
    int geoapifyRequests;

    @ConfigProperty(name = "external-api.geoapify.period-seconds", defaultValue = "1")
    int geoapifyPeriodSeconds;

    @ConfigProperty(name = "external-api.nominatim.requests", defaultValue = "1")
    int nominatimRequests;

    @ConfigProperty(name = "external-api.nominatim.period-seconds", defaultValue = "1")
    int nominatimPeriodSeconds;

    @ConfigProperty(name = "external-api.weather.requests", defaultValue = "5")
    int weatherRequests;

    @ConfigProperty(name = "external-api.weather.period-seconds", defaultValue = "1")
    int weatherPeriodSeconds;

    @ConfigProperty(name = "external-api.max-wait-seconds", defaultValue = "5")
    int maxWaitSeconds;

    Bucket geoapify;

    Bucket nominatim;

    Bucket weather;

    @PostConstruct
    void init() {
        this.geoapify = bucket(this.geoapifyRequests, this.geoapifyPeriodSeconds);
        this.nominatim = bucket(this.nominatimRequests, this.nominatimPeriodSeconds);
        this.weather = bucket(this.weatherRequests, this.weatherPeriodSeconds);
    }

    public void acquireGeoapify() {
        acquire(this.geoapify, "Geoapify");
    }

    public void acquireNominatim() {
        acquire(this.nominatim, "Nominatim");
    }

    public void acquireWeather() {
        acquire(this.weather, "Open-Meteo");
    }

    private Bucket bucket(int requests, int periodSeconds) {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(requests)
                        .refillGreedy(requests, Duration.ofSeconds(periodSeconds))
                        .build())
                .build();
    }

    private void acquire(Bucket bucket, String api) {
        boolean acquired = this.maxWaitSeconds <= 0
                ? bucket.tryConsume(1)
                : bucket.asBlocking().tryConsumeUninterruptibly(1, Duration.ofSeconds(this.maxWaitSeconds));
        if (acquired) {
            return;
        }
        long retryAfterSeconds = Math.max(1,
                bucket.estimateAbilityToConsume(1).getNanosToWaitForRefill() / 1_000_000_000L);
        LOG.log(System.Logger.Level.WARNING,
                "External API rate limit exceeded for {0} – retry after {1}s", api, retryAfterSeconds);
        throw TooManyRequests.exception(retryAfterSeconds);
    }
}
