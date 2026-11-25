//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.control;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import net.gauntlet.locate.me.users.entity.User;
import net.gauntlet.locate.me.users.entity.UserRole;
import net.gauntlet.locate.me.users.entity.UserStatus;

/**
 * One-time, idempotent reconciliation of the legacy user population from the
 * {@code allowed.user.ids} configuration into H2.
 *
 * <p>Application scope because it observes {@link StartupEvent}; a dependent
 * control would not be notified reliably (same reason as {@code SystemInfo}).
 *
 * <p>The bootstrap only inserts missing accounts. It never overwrites a password
 * hash, recovery email, role, status, login state or business relationship, and
 * it never deletes an account whose identifier disappeared from the
 * configuration. The shared demo user is recognized and deliberately not
 * persisted as a normal account.
 */
@ApplicationScoped
public class LegacyUsers {

    static final System.Logger LOG = System.getLogger(LegacyUsers.class.getName());

    static final int MAX_USER_ID_LENGTH = 32;

    @ConfigProperty(name = "allowed.user.ids", defaultValue = "")
    String legacyUserIds;

    @ConfigProperty(name = "auth.admin.user.ids", defaultValue = "")
    String adminUserIds;

    @Inject
    EntityManager em;

    void onStart(@Observes StartupEvent event) {
        reconcile();
    }

    public void reconcile() {
        QuarkusTransaction.requiringNew().run(this::reconcileInTransaction);
    }

    void reconcileInTransaction() {
        int created = 0;
        int skipped = 0;
        for (String userId : parseIds(this.legacyUserIds)) {
            if (DemoUserPolicy.isDemo(userId)) {
                continue;
            }
            if (userId.length() > MAX_USER_ID_LENGTH) {
                LOG.log(System.Logger.Level.WARNING,
                        "Skipping legacy user id longer than {0} characters", MAX_USER_ID_LENGTH);
                skipped++;
                continue;
            }
            String lower = userId.toLowerCase(Locale.ROOT);
            if (findByLower(lower) != null) {
                continue;
            }
            Instant now = Instant.now();
            this.em.persist(new User()
                    .userId(userId)
                    .userIdLower(lower)
                    .status(UserStatus.ACTIVE)
                    .roles(Set.of(UserRole.USER))
                    .createdAt(now)
                    .updatedAt(now));
            created++;
        }
        int granted = grantAdminRoles();
        LOG.log(System.Logger.Level.INFO,
                "Legacy user bootstrap finished: {0} created, {1} skipped, {2} admin role(s) granted",
                created, skipped, granted);
    }

    int grantAdminRoles() {
        int granted = 0;
        for (String userId : parseIds(this.adminUserIds)) {
            if (DemoUserPolicy.isDemo(userId)) {
                LOG.log(System.Logger.Level.WARNING, "Ignoring the shared demo user in auth.admin.user.ids");
                continue;
            }
            User user = findByLower(userId.toLowerCase(Locale.ROOT));
            if (user == null) {
                LOG.log(System.Logger.Level.WARNING,
                        "Admin bootstrap user does not exist and was not created: {0}", userId);
                continue;
            }
            if (!user.hasRole(UserRole.ADMIN)) {
                user.addRole(UserRole.ADMIN);
                user.updatedAt(Instant.now());
                granted++;
            }
        }
        return granted;
    }

    User findByLower(String lowerUserId) {
        return this.em.createQuery("SELECT u FROM User u WHERE u.userIdLower = :id", User.class)
                .setParameter("id", lowerUserId)
                .getResultList().stream().findFirst().orElse(null);
    }

    /**
     * Trims entries, drops blanks produced by repeated or trailing commas and
     * collapses case-insensitive duplicates. Surrounding whitespace is the only
     * transformation applied; an identifier is never rewritten internally.
     */
    static List<String> parseIds(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        Map<String, String> unique = new LinkedHashMap<>();
        for (String part : raw.split(",")) {
            String trimmed = part.strip();
            if (trimmed.isEmpty()) {
                continue;
            }
            String key = trimmed.toLowerCase(Locale.ROOT);
            if (unique.putIfAbsent(key, trimmed) != null) {
                LOG.log(System.Logger.Level.WARNING,
                        "Ignoring duplicate legacy user id (case-insensitive): {0}", trimmed);
            }
        }
        return List.copyOf(unique.values());
    }
}
