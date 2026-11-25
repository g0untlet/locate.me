//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.control;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import net.gauntlet.locate.me.Control;
import net.gauntlet.locate.me.users.entity.User;

/**
 * Persisted failed-login counter with progressive temporary cooldowns.
 *
 * <p>A failed login must survive the 401 response, so the write runs in its own
 * transaction. The same applies to the successful-login bookkeeping: the login
 * boundary deliberately has no surrounding transaction, which keeps the
 * credential check free of a rollback-only persistence context.
 *
 * <p>Accounts are never blocked permanently: the attempt counter escalates the
 * cooldown only for as long as the failures continue, and a successful login
 * resets it.
 */
@Control
public class LoginAttempts {

    static final System.Logger LOG = System.getLogger(LoginAttempts.class.getName());

    @Inject
    EntityManager em;

    @ConfigProperty(name = "auth.login.max-failed-attempts", defaultValue = "5")
    int maxFailedAttempts;

    @ConfigProperty(name = "auth.login.cooldowns", defaultValue = "1m,5m,15m")
    List<Duration> cooldowns;

    public void recordFailure(String userId) {
        QuarkusTransaction.requiringNew().run(() -> {
            User user = managed(userId);
            if (user == null) {
                return;
            }
            int attempts = user.failedLoginAttempts() + 1;
            user.failedLoginAttempts(attempts);
            if (attempts >= this.maxFailedAttempts) {
                user.lockedUntil(Instant.now().plus(cooldown(attempts)));
            }
            user.updatedAt(Instant.now());
            LOG.log(System.Logger.Level.INFO, "Failed login attempt {0} for user {1}", attempts, user.userId());
        });
    }

    public void recordSuccess(String userId) {
        QuarkusTransaction.requiringNew().run(() -> {
            User user = managed(userId);
            if (user == null) {
                return;
            }
            Instant now = Instant.now();
            user.failedLoginAttempts(0)
                    .lockedUntil(null)
                    .lastLoginAt(now)
                    .updatedAt(now);
        });
    }

    Duration cooldown(int attempts) {
        if (this.cooldowns == null || this.cooldowns.isEmpty()) {
            return Duration.ofMinutes(1);
        }
        int step = attempts / Math.max(1, this.maxFailedAttempts) - 1;
        return this.cooldowns.get(Math.min(Math.max(step, 0), this.cooldowns.size() - 1));
    }

    User managed(String userId) {
        if (userId == null) {
            return null;
        }
        return this.em.createQuery("SELECT u FROM User u WHERE u.userIdLower = :id", User.class)
                .setParameter("id", userId.toLowerCase(Locale.ROOT))
                .getResultList().stream().findFirst().orElse(null);
    }
}
