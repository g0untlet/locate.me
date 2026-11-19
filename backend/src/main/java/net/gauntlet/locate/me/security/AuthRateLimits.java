//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.security;

import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.vertx.core.net.SocketAddress;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Per-client protection for the public authentication endpoints.
 *
 * <p>The annotation-based {@code pwa-*} buckets are keyed by the {@code userId}
 * query parameter, which does not exist on registration or login. These buckets
 * are therefore created programmatically and keyed by the client address (and,
 * where the requirement asks for it, additionally by the user id / userId or
 * reset token).
 *
 * <p>Buckets are in memory: they protect a single instance and reset on restart.
 * That is sufficient for the intended deployment and avoids server-side
 * authentication state.
 */
@RequestScoped
public class AuthRateLimits {

    // Bounded so a flood of arbitrary identifiers cannot grow the registry without limit.
    static final int MAX_BUCKETS = 10_000;

    static final Map<String, Bucket> BUCKETS = new ConcurrentHashMap<>();

    @Inject
    RoutingContext routingContext;

    @ConfigProperty(name = "auth.rate-limit.login.permitted-uses", defaultValue = "5")
    int loginUses;

    @ConfigProperty(name = "auth.rate-limit.login.period", defaultValue = "1m")
    Duration loginPeriod;

    @ConfigProperty(name = "auth.rate-limit.registration.permitted-uses", defaultValue = "3")
    int registrationUses;

    @ConfigProperty(name = "auth.rate-limit.registration.period", defaultValue = "1h")
    Duration registrationPeriod;

    @ConfigProperty(name = "auth.rate-limit.claim.permitted-uses", defaultValue = "5")
    int claimUses;

    @ConfigProperty(name = "auth.rate-limit.claim.period", defaultValue = "1h")
    Duration claimPeriod;

    @ConfigProperty(name = "auth.rate-limit.migration-status.permitted-uses", defaultValue = "10")
    int migrationStatusUses;

    @ConfigProperty(name = "auth.rate-limit.migration-status.period", defaultValue = "1m")
    Duration migrationStatusPeriod;

    @ConfigProperty(name = "auth.rate-limit.demo.permitted-uses", defaultValue = "20")
    int demoUses;

    @ConfigProperty(name = "auth.rate-limit.demo.period", defaultValue = "1m")
    Duration demoPeriod;

    public void checkLogin() {
        check("login|" + clientAddress(), this.loginUses, this.loginPeriod);
    }

    public void checkRegistration() {
        check("registration|" + clientAddress(), this.registrationUses, this.registrationPeriod);
    }

    public void checkClaim(String userId) {
        check("claim|" + clientAddress() + "|" + identity(userId), this.claimUses, this.claimPeriod);
    }

    public void checkMigrationStatus(String userId) {
        check("migration-status|" + clientAddress() + "|" + identity(userId),
                this.migrationStatusUses, this.migrationStatusPeriod);
    }

    public void checkDemo() {
        check("demo|" + clientAddress(), this.demoUses, this.demoPeriod);
    }

    public String clientAddress() {
        SocketAddress address = this.routingContext.request().remoteAddress();
        return address != null && address.host() != null ? address.host() : "unknown";
    }

    private String identity(String userId) {
        return userId == null || userId.isBlank() ? "unknown" : userId.strip().toLowerCase(Locale.ROOT);
    }

    private void check(String key, int permittedUses, Duration period) {
        if (permittedUses <= 0) {
            return;
        }
        if (BUCKETS.size() > MAX_BUCKETS) {
            BUCKETS.clear();
        }
        Bucket bucket = BUCKETS.computeIfAbsent(key, ignored -> Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(permittedUses)
                        .refillGreedy(permittedUses, period)
                        .build())
                .build());
        if (bucket.tryConsume(1)) {
            return;
        }
        long retryAfterSeconds = Math.max(1,
                bucket.estimateAbilityToConsume(1).getNanosToWaitForRefill() / 1_000_000_000L);
        throw TooManyRequests.exception(retryAfterSeconds);
    }
}
