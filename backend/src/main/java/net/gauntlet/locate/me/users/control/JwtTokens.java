//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.control;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.stream.Collectors;
import io.quarkus.runtime.StartupEvent;
import io.smallrye.jwt.build.Jwt;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import net.gauntlet.locate.me.users.entity.User;

/**
 * Issues the stateless bearer token after registration, migration or login.
 *
 * <p>Only the claims needed to identify and authorize the caller are included.
 * Credentials, recovery data, login state and business data never enter a
 * token, and no server-side session or revocation list exists.
 *
 * <p>Application scope so the startup self-check can observe {@link StartupEvent}
 * and fail fast when the signing key was not provisioned.
 */
@ApplicationScoped
public class JwtTokens {

    static final System.Logger LOG = System.getLogger(JwtTokens.class.getName());

    public record IssuedToken(String token, Instant expiresAt) {
    }

    @ConfigProperty(name = "auth.jwt.issuer", defaultValue = "locate.me")
    String issuer;

    @ConfigProperty(name = "auth.jwt.audience", defaultValue = "locate.me-pwa")
    String audience;

    @ConfigProperty(name = "auth.jwt.lifespan", defaultValue = "30d")
    Duration lifespan;

    /**
     * Signs a throw-away token at startup: a missing or unreadable key location
     * must break the deployment immediately instead of failing the first login.
     */
    void onStart(@Observes StartupEvent event) {
        try {
            Jwt.claims().subject("startup-check").expiresIn(Duration.ofMinutes(1)).sign();
            LOG.log(System.Logger.Level.INFO, "JWT signing key is available");
        } catch (RuntimeException e) {
            throw new IllegalStateException(
                    "JWT signing key is missing or unreadable (smallrye.jwt.sign.key.location)", e);
        }
    }

    public IssuedToken issue(User user) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(this.lifespan);
        Set<String> groups = user.roles().stream().map(Enum::name).collect(Collectors.toSet());
        String token = Jwt.claims()
                .subject(user.userId())
                .issuer(this.issuer)
                .audience(this.audience)
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .groups(groups)
                .sign();
        return new IssuedToken(token, expiresAt);
    }
}
