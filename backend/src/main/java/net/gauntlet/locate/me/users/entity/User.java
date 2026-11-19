//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.entity;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import jakarta.json.JsonString;
import jakarta.json.JsonValue;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import jakarta.persistence.Version;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * A Locate.Me user account. The permanent identity is {@code userId}; the
 * recovery email is never a login name. {@code userIdLower} mirrors the
 * identifier in lower case so lookups and uniqueness are case-insensitive
 * without rewriting the identifier that existing business data refers to.
 *
 * <p>The transient credential fields exist only to carry request input to the
 * control layer. They are neither persisted nor serialized; {@link #toJSON()}
 * returns an explicit allowlisted projection instead.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @NotBlank
    @Size(max = 32)
    @Column(name = "user_id", length = 32, nullable = false)
    String userId;

    @Column(name = "user_id_lower", length = 32, nullable = false, unique = true)
    String userIdLower;

    @Size(max = 128)
    @Column(length = 128)
    String name;

    @Size(max = 254)
    @Column(length = 254, unique = true)
    String email;

    @Column(name = "password_hash", length = 255)
    String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(length = 32, nullable = false)
    UserStatus status;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "role", length = 32, nullable = false)
    @Enumerated(EnumType.STRING)
    Set<UserRole> roles = new LinkedHashSet<>();

    @Column(name = "failed_login_attempts", nullable = false)
    int failedLoginAttempts;

    @Column(name = "locked_until")
    Instant lockedUntil;

    @Column(name = "last_login_at")
    Instant lastLoginAt;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    @Version
    @Column(name = "entity_version", nullable = false)
    long version;

    // Write-only request input; never persisted, never serialized.
    @Transient
    transient String password;

    @Transient
    transient String currentPassword;

    @Transient
    transient String passwordConfirmation;

    public User() {
    }

    public String userId() {
        return this.userId;
    }

    public User userId(String userId) {
        this.userId = userId;
        return this;
    }

    public String userIdLower() {
        return this.userIdLower;
    }

    public User userIdLower(String userIdLower) {
        this.userIdLower = userIdLower;
        return this;
    }

    public String name() {
        return this.name;
    }

    public User name(String name) {
        this.name = name;
        return this;
    }

    public String email() {
        return this.email;
    }

    public User email(String email) {
        this.email = email;
        return this;
    }

    public String passwordHash() {
        return this.passwordHash;
    }

    public User passwordHash(String passwordHash) {
        this.passwordHash = passwordHash;
        return this;
    }

    public UserStatus status() {
        return this.status;
    }

    public User status(UserStatus status) {
        this.status = status;
        return this;
    }

    public Set<UserRole> roles() {
        return Set.copyOf(this.roles);
    }

    public User roles(Set<UserRole> roles) {
        // Mutate in place: the field may hold Hibernate's persistent collection,
        // which must not be replaced with a detached set.
        this.roles.clear();
        this.roles.addAll(roles);
        return this;
    }

    public User addRole(UserRole role) {
        this.roles.add(role);
        return this;
    }

    public boolean hasRole(UserRole role) {
        return this.roles.contains(role);
    }

    public int failedLoginAttempts() {
        return this.failedLoginAttempts;
    }

    public User failedLoginAttempts(int failedLoginAttempts) {
        this.failedLoginAttempts = failedLoginAttempts;
        return this;
    }

    public Instant lockedUntil() {
        return this.lockedUntil;
    }

    public User lockedUntil(Instant lockedUntil) {
        this.lockedUntil = lockedUntil;
        return this;
    }

    public Instant lastLoginAt() {
        return this.lastLoginAt;
    }

    public User lastLoginAt(Instant lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
        return this;
    }

    public Instant createdAt() {
        return this.createdAt;
    }

    public User createdAt(Instant createdAt) {
        this.createdAt = createdAt;
        return this;
    }

    public Instant updatedAt() {
        return this.updatedAt;
    }

    public User updatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
        return this;
    }

    public long version() {
        return this.version;
    }

    public String password() {
        return this.password;
    }

    public User password(String password) {
        this.password = password;
        return this;
    }

    public String currentPassword() {
        return this.currentPassword;
    }

    public User currentPassword(String currentPassword) {
        this.currentPassword = currentPassword;
        return this;
    }

    public String passwordConfirmation() {
        return this.passwordConfirmation;
    }

    public User passwordConfirmation(String passwordConfirmation) {
        this.passwordConfirmation = passwordConfirmation;
        return this;
    }

    /**
     * Allowlisted response projection. Passwords, hashes, reset material, login
     * counters, locks, the optimistic-locking version and the mirrored lower-case
     * identifier must never leave the backend.
     */
    public JsonObject toJSON() {
        JsonObjectBuilder builder = Json.createObjectBuilder()
                .add("userId", this.userId)
                .add("status", this.status != null ? this.status.name() : UserStatus.ACTIVE.name())
                .add("roles", rolesArray());
        if (this.name != null) {
            builder.add("name", this.name);
        }
        if (this.email != null) {
            builder.add("email", this.email);
        }
        if (this.lastLoginAt != null) {
            builder.add("lastLoginAt", this.lastLoginAt.toString());
        }
        if (this.createdAt != null) {
            builder.add("createdAt", this.createdAt.toString());
        }
        if (this.updatedAt != null) {
            builder.add("updatedAt", this.updatedAt.toString());
        }
        return builder.build();
    }

    private JsonArray rolesArray() {
        JsonArrayBuilder array = Json.createArrayBuilder();
        this.roles.stream().map(Enum::name).sorted().forEach(array::add);
        return array.build();
    }

    /**
     * Reads only the fields the public registration, login, claim and
     * self-service operations may supply. Roles, status, hashes, counters and
     * timestamps in the request body are ignored, never trusted.
     */
    public static User fromJson(JsonObject json) {
        User user = new User();
        if (json == null) {
            return user;
        }
        user.userId(string(json, "userId"));
        user.name(string(json, "name"));
        user.email(string(json, "email"));
        user.password(string(json, "password"));
        user.currentPassword(string(json, "currentPassword"));
        user.passwordConfirmation(string(json, "passwordConfirmation"));
        return user;
    }

    /**
     * Administrative input additionally carries the server-managed fields an
     * administrator is allowed to decide: status and roles. Password hashes,
     * counters, lock state and timestamps remain server-controlled.
     *
     * @throws IllegalArgumentException when status or a role is unknown
     */
    public static User fromAdminJson(JsonObject json) {
        User user = fromJson(json);
        if (json == null) {
            return user;
        }
        String status = string(json, "status");
        if (status != null) {
            user.status(UserStatus.valueOf(status.strip().toUpperCase()));
        }
        JsonArray roles = array(json, "roles");
        if (roles != null && !roles.isEmpty()) {
            Set<UserRole> parsed = new LinkedHashSet<>();
            roles.stream()
                    .map(JsonString.class::cast)
                    .map(JsonString::getString)
                    .map(role -> UserRole.valueOf(role.strip().toUpperCase()))
                    .forEach(parsed::add);
            user.roles(parsed);
        }
        return user;
    }

    private static String string(JsonObject json, String name) {
        if (!json.containsKey(name) || json.isNull(name)) {
            return null;
        }
        JsonValue value = json.get(name);
        return value.getValueType() == JsonValue.ValueType.STRING ? json.getString(name) : null;
    }

    private static JsonArray array(JsonObject json, String name) {
        return json.containsKey(name) && !json.isNull(name) ? json.getJsonArray(name) : null;
    }
}
