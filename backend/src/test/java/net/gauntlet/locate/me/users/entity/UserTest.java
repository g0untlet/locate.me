//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Set;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import org.junit.jupiter.api.Test;

class UserTest {

    @Test
    void jsonProjectionContainsOnlyAllowlistedFields() {
        User user = new User()
                .userId("hero123")
                .userIdLower("hero123")
                .name("Hero")
                .email("hero@example.de")
                .passwordHash("$2a$10$not-a-real-hash")
                .status(UserStatus.ACTIVE)
                .roles(Set.of(UserRole.USER, UserRole.ADMIN))
                .failedLoginAttempts(3)
                .lockedUntil(Instant.parse("2026-01-01T00:00:00Z"))
                .createdAt(Instant.parse("2025-01-01T00:00:00Z"))
                .updatedAt(Instant.parse("2025-06-01T00:00:00Z"));

        JsonObject json = user.toJSON();

        assertThat(json.getString("userId")).isEqualTo("hero123");
        assertThat(json.getString("name")).isEqualTo("Hero");
        assertThat(json.getString("email")).isEqualTo("hero@example.de");
        assertThat(json.getString("status")).isEqualTo("ACTIVE");
        assertThat(json.getJsonArray("roles")).hasSize(2);
        assertThat(json.getBoolean("hasPassword")).isTrue();
        assertThat(json.containsKey("passwordHash")).isFalse();
        assertThat(json.containsKey("password")).isFalse();
        assertThat(json.containsKey("currentPassword")).isFalse();
        assertThat(json.containsKey("resetToken")).isFalse();
        assertThat(json.containsKey("failedLoginAttempts")).isFalse();
        assertThat(json.containsKey("lockedUntil")).isFalse();
        assertThat(json.containsKey("version")).isFalse();
        assertThat(json.containsKey("userIdLower")).isFalse();
    }

    @Test
    void jsonProjectionReportsWhetherAPasswordExistsWithoutExposingIt() {
        JsonObject migrated = new User().userId("migrated").passwordHash("$2a$10$not-a-real-hash").toJSON();
        JsonObject legacy = new User().userId("legacy").toJSON();

        assertThat(migrated.getBoolean("hasPassword")).isTrue();
        assertThat(legacy.getBoolean("hasPassword")).isFalse();
        assertThat(migrated.containsKey("passwordHash")).isFalse();
        assertThat(legacy.containsKey("passwordHash")).isFalse();
    }

    @Test
    void publicInputIgnoresServerManagedFields() {
        JsonObject json = Json.createObjectBuilder()
                .add("userId", "Hero123")
                .add("name", " Hero ")
                .add("email", "Hero@Example.DE")
                .add("password", "correct-horse")
                .add("currentPassword", "old-horse")
                .add("passwordConfirmation", "correct-horse")
                .add("passwordHash", "forged")
                .add("status", "DISABLED")
                .add("roles", Json.createArrayBuilder().add("ADMIN").build())
                .add("failedLoginAttempts", 99)
                .add("lockedUntil", "2020-01-01T00:00:00Z")
                .build();

        User user = User.fromJson(json);

        assertThat(user.userId()).isEqualTo("Hero123");
        assertThat(user.name()).isEqualTo(" Hero ");
        assertThat(user.email()).isEqualTo("Hero@Example.DE");
        assertThat(user.password()).isEqualTo("correct-horse");
        assertThat(user.currentPassword()).isEqualTo("old-horse");
        assertThat(user.passwordConfirmation()).isEqualTo("correct-horse");
        assertThat(user.passwordHash()).isNull();
        assertThat(user.status()).isNull();
        assertThat(user.roles()).isEmpty();
        assertThat(user.failedLoginAttempts()).isZero();
        assertThat(user.lockedUntil()).isNull();
    }

    @Test
    void administrativeInputMaySetStatusAndRoles() {
        JsonObject json = Json.createObjectBuilder()
                .add("userId", "hero123")
                .add("status", "disabled")
                .add("roles", Json.createArrayBuilder().add("admin").build())
                .build();

        User user = User.fromAdminJson(json);

        assertThat(user.status()).isEqualTo(UserStatus.DISABLED);
        assertThat(user.roles()).containsExactly(UserRole.ADMIN);
    }

    @Test
    void administrativeInputRejectsUnknownStatusOrRole() {
        assertThatThrownBy(() -> User.fromAdminJson(Json.createObjectBuilder()
                .add("status", "SLEEPING").build()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> User.fromAdminJson(Json.createObjectBuilder()
                .add("roles", Json.createArrayBuilder().add("SUPERUSER").build()).build()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
