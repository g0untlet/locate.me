//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.control;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import net.gauntlet.locate.me.Control;
import net.gauntlet.locate.me.security.AuthErrors;
import net.gauntlet.locate.me.users.entity.User;
import net.gauntlet.locate.me.users.entity.UserRole;
import net.gauntlet.locate.me.users.entity.UserStatus;

/**
 * Registration, migration, login and account maintenance.
 *
 * <p>Every operation reads the managed entity, applies only the fields allowed
 * for that operation and leaves server-managed state (identifier, hashes,
 * timestamps, counters, lock and roles where they are not explicitly editable)
 * untouched. Database uniqueness is the final guard against concurrent
 * registrations; the application check exists for a friendly error.
 */
@Control
public class UserAccounts {

    static final System.Logger LOG = System.getLogger(UserAccounts.class.getName());

    static final String INVALID_CREDENTIALS = "Invalid credentials";

    @Inject
    EntityManager em;

    @Inject
    UserIds userIds;

    @Inject
    Emails emails;

    @Inject
    Passwords passwords;

    @Inject
    LoginAttempts loginAttempts;

    public Optional<User> findByUserId(String userId) {
        String lookup = this.userIds.normalizeForLookup(userId);
        if (lookup == null) {
            return Optional.empty();
        }
        return this.em.createQuery("SELECT u FROM User u WHERE u.userIdLower = :id", User.class)
                .setParameter("id", lookup)
                .getResultList().stream().findFirst();
    }

    public Optional<User> findByEmail(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        return this.em.createQuery("SELECT u FROM User u WHERE u.email = :email", User.class)
                .setParameter("email", email.strip().toLowerCase(Locale.ROOT))
                .getResultList().stream().findFirst();
    }

    public User requireByUserId(String userId) {
        return findByUserId(userId).orElseThrow(() -> AuthErrors.notFound("User not found"));
    }

    public List<User> findAll() {
        return this.em.createQuery("SELECT u FROM User u ORDER BY u.userIdLower", User.class).getResultList();
    }

    public User register(User input) {
        String userId = this.userIds.normalizeForRegistration(input.userId());
        if (findByUserId(userId).isPresent()) {
            throw AuthErrors.conflict("userId is already taken");
        }
        String email = this.emails.normalize(input.email());
        if (findByEmail(email).isPresent()) {
            throw AuthErrors.conflict("Email is already registered");
        }
        this.passwords.validate(input.password());

        Instant now = Instant.now();
        User user = new User()
                .userId(userId)
                .userIdLower(userId)
                .name(normalizeName(input.name()))
                .email(email)
                .passwordHash(this.passwords.hash(input.password()))
                .status(UserStatus.ACTIVE)
                .roles(Set.of(UserRole.USER))
                .createdAt(now)
                .updatedAt(now);
        persist(user);
        LOG.log(System.Logger.Level.INFO, "Registered new user {0}", userId);
        return user;
    }

    /**
     * One-time migration of an imported legacy account. The identifier, roles
     * and all business-data relationships are preserved; only the password and
     * recovery email are added.
     */
    public User claim(User input) {
        String lookup = this.userIds.normalizeForLookup(input.userId());
        if (lookup == null) {
            throw AuthErrors.badRequest("userId is mandatory");
        }
        User user = findByUserId(lookup).orElse(null);
        if (user == null) {
            // The demo identity is deliberately not persisted, so recognize it
            // before reporting the identifier as unknown.
            if (input.userId() != null && DemoUserPolicy.isDemo(input.userId().strip())) {
                throw AuthErrors.forbidden("The demo user cannot be migrated");
            }
            throw AuthErrors.notFound("User not found");
        }
        if (DemoUserPolicy.isDemo(user.userId())) {
            throw AuthErrors.forbidden("The demo user cannot be migrated");
        }
        if (user.passwordHash() != null) {
            throw AuthErrors.conflict("Account is already migrated");
        }
        if (user.status() != UserStatus.ACTIVE) {
            throw AuthErrors.forbidden("Account is not active");
        }
        String email = this.emails.normalize(input.email());
        Optional<User> emailOwner = findByEmail(email);
        if (emailOwner.isPresent() && !emailOwner.get().userId().equals(user.userId())) {
            throw AuthErrors.conflict("Email is already registered");
        }
        this.passwords.validate(input.password());

        user.email(email)
                .passwordHash(this.passwords.hash(input.password()))
                .status(UserStatus.ACTIVE)
                .failedLoginAttempts(0)
                .lockedUntil(null)
                .updatedAt(Instant.now());
        // Optional display name; leaving it out keeps any existing value.
        if (input.name() != null) {
            user.name(normalizeName(input.name()));
        }
        if (user.roles().isEmpty()) {
            user.addRole(UserRole.USER);
        }
        flush();
        LOG.log(System.Logger.Level.INFO, "Migrated legacy user {0}", user.userId());
        return user;
    }

    /**
     * Verifies the credentials and returns the account. Unknown, unmigrated,
     * disabled, locked and wrong-password accounts all produce the same external
     * error; the failure counter is written in its own transaction so it
     * survives the 401.
     */
    public User authenticate(User input) {
        String lookup = this.userIds.normalizeForLookup(input.userId());
        User user = lookup == null ? null : findByUserId(lookup).orElse(null);
        boolean usable = user != null
                && user.passwordHash() != null
                && user.status() == UserStatus.ACTIVE
                && (user.lockedUntil() == null || !user.lockedUntil().isAfter(Instant.now()));
        String hash = usable ? user.passwordHash() : this.passwords.dummyHash();
        boolean verified = this.passwords.matches(input.password(), hash);
        if (!usable || !verified) {
            if (user != null) {
                this.loginAttempts.recordFailure(user.userId());
            }
            throw AuthErrors.unauthorized(INVALID_CREDENTIALS);
        }
        this.loginAttempts.recordSuccess(user.userId());
        LOG.log(System.Logger.Level.INFO, "User {0} logged in", user.userId());
        return user;
    }

    public User updateProfile(User target, User input) {
        if (input.name() != null) {
            target.name(normalizeName(input.name()));
        }
        target.updatedAt(Instant.now());
        flush();
        LOG.log(System.Logger.Level.INFO, "Profile updated for user {0}", target.userId());
        return target;
    }

    public void changePassword(User target, User input) {
        this.passwords.validate(input.password());
        if (input.passwordConfirmation() != null && !input.passwordConfirmation().equals(input.password())) {
            throw AuthErrors.badRequest("passwordConfirmation does not match");
        }
        verifyCurrentPassword(target, input.currentPassword());
        target.passwordHash(this.passwords.hash(input.password()))
                .failedLoginAttempts(0)
                .lockedUntil(null)
                .bumpAuthEpoch()
                .updatedAt(Instant.now());
        flush();
        LOG.log(System.Logger.Level.INFO, "Password changed for user {0}", target.userId());
    }

    /**
     * Administrative password reset, used when a user forgot the password or
     * lost access to the recovery email. The administrator never sees the old
     * password; the new one is hashed like any other. The credential generation
     * is bumped, so all tokens of the target account stop working immediately
     * (also after a later reactivation).
     */
    public void resetPassword(User target, User input) {
        this.passwords.validate(input.password());
        if (input.passwordConfirmation() != null && !input.passwordConfirmation().equals(input.password())) {
            throw AuthErrors.badRequest("passwordConfirmation does not match");
        }
        target.passwordHash(this.passwords.hash(input.password()))
                .failedLoginAttempts(0)
                .lockedUntil(null)
                .bumpAuthEpoch()
                .updatedAt(Instant.now());
        flush();
        LOG.log(System.Logger.Level.INFO, "Administrator reset the password for user {0}", target.userId());
    }

    public void changeRecoveryEmail(User target, User input) {
        verifyCurrentPassword(target, input.currentPassword());
        String email = this.emails.normalize(input.email());
        Optional<User> owner = findByEmail(email);
        if (owner.isPresent() && !owner.get().userId().equals(target.userId())) {
            throw AuthErrors.conflict("Email is already registered");
        }
        target.email(email).updatedAt(Instant.now());
        flush();
        LOG.log(System.Logger.Level.INFO, "Recovery email changed for user {0}", target.userId());
    }

    public User createByAdmin(User input) {
        String userId = this.userIds.normalizeForRegistration(input.userId());
        if (findByUserId(userId).isPresent()) {
            throw AuthErrors.conflict("userId is already taken");
        }
        String email = null;
        if (input.email() != null && !input.email().isBlank()) {
            email = this.emails.normalize(input.email());
            if (findByEmail(email).isPresent()) {
                throw AuthErrors.conflict("Email is already registered");
            }
        }
        this.passwords.validate(input.password());

        Instant now = Instant.now();
        User user = new User()
                .userId(userId)
                .userIdLower(userId)
                .name(normalizeName(input.name()))
                .email(email)
                .passwordHash(this.passwords.hash(input.password()))
                .status(input.status() != null ? input.status() : UserStatus.ACTIVE)
                .roles(input.roles().isEmpty() ? Set.of(UserRole.USER) : input.roles())
                .createdAt(now)
                .updatedAt(now);
        persist(user);
        LOG.log(System.Logger.Level.INFO, "Administrator created user {0}", userId);
        return user;
    }

    public User updateByAdmin(User target, User input) {
        if (input.userId() != null && !input.userId().isBlank()
                && !input.userId().strip().equalsIgnoreCase(target.userId())) {
            throw AuthErrors.conflict("userId must not be changed");
        }
        UserStatus status = input.status() != null ? input.status() : target.status();
        Set<UserRole> roles = input.roles().isEmpty() ? target.roles() : input.roles();
        guardLastAdmin(target, status == UserStatus.ACTIVE && roles.contains(UserRole.ADMIN));

        if (input.name() != null) {
            target.name(normalizeName(input.name()));
        }
        if (input.email() != null && !input.email().isBlank()) {
            String email = this.emails.normalize(input.email());
            Optional<User> owner = findByEmail(email);
            if (owner.isPresent() && !owner.get().userId().equals(target.userId())) {
                throw AuthErrors.conflict("Email is already registered");
            }
            target.email(email);
        }
        target.status(status).roles(roles).updatedAt(Instant.now());
        flush();
        LOG.log(System.Logger.Level.INFO, "Administrator updated user {0}", target.userId());
        return target;
    }

    /**
     * Preferred over physical deletion: business data refers to the user by
     * identifier and must not be orphaned.
     */
    public void deactivate(User target) {
        guardLastAdmin(target, false);
        target.status(UserStatus.DISABLED).updatedAt(Instant.now());
        flush();
        LOG.log(System.Logger.Level.INFO, "Deactivated user {0}", target.userId());
    }

    long activeAdminCount() {
        return this.em.createQuery(
                "SELECT COUNT(DISTINCT u) FROM User u JOIN u.roles r WHERE r = :role AND u.status = :status",
                Long.class)
                .setParameter("role", UserRole.ADMIN)
                .setParameter("status", UserStatus.ACTIVE)
                .getSingleResult();
    }

    void guardLastAdmin(User target, boolean staysActiveAdmin) {
        if (staysActiveAdmin || !target.hasRole(UserRole.ADMIN) || target.status() != UserStatus.ACTIVE) {
            return;
        }
        if (activeAdminCount() <= 1) {
            throw AuthErrors.conflict("The last active administrator cannot be deactivated or demoted");
        }
    }

    void verifyCurrentPassword(User target, String currentPassword) {
        if (!this.passwords.matches(currentPassword, target.passwordHash())) {
            throw AuthErrors.unauthorized("Current password is incorrect");
        }
    }

    void persist(User user) {
        try {
            this.em.persist(user);
            this.em.flush();
        } catch (PersistenceException e) {
            // Concurrent registration or email collision, surfaced by the unique
            // constraints. The transaction is rolled back by the caller.
            throw AuthErrors.conflict("userId or email is already in use");
        }
    }

    void flush() {
        try {
            this.em.flush();
        } catch (PersistenceException e) {
            throw AuthErrors.conflict("userId or email is already in use");
        }
    }

    String normalizeName(String name) {
        if (name == null) {
            return null;
        }
        String trimmed = name.strip();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > 128) {
            throw AuthErrors.badRequest("name must be at most 128 characters long");
        }
        return trimmed;
    }
}
