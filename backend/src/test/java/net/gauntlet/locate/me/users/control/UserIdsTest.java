//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.control;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.ws.rs.WebApplicationException;
import org.junit.jupiter.api.Test;

class UserIdsTest {

    final UserIds userIds = new UserIds();

    @Test
    void normalizationLowercasesValidIdentifiers() {
        assertThat(this.userIds.normalizeForRegistration("Hero_1")).isEqualTo("hero_1");
        assertThat(this.userIds.normalizeForRegistration("a-b_c")).isEqualTo("a-b_c");
        assertThat(this.userIds.normalizeForRegistration("abc")).isEqualTo("abc");
    }

    @Test
    void registrationRejectsInvalidLengthAndCharacters() {
        assertThatThrownBy(() -> this.userIds.normalizeForRegistration("ab"))
                .isInstanceOf(WebApplicationException.class);
        assertThatThrownBy(() -> this.userIds.normalizeForRegistration("a".repeat(33)))
                .isInstanceOf(WebApplicationException.class);
        assertThatThrownBy(() -> this.userIds.normalizeForRegistration("hero!"))
                .isInstanceOf(WebApplicationException.class);
        assertThatThrownBy(() -> this.userIds.normalizeForRegistration("héro"))
                .isInstanceOf(WebApplicationException.class);
    }

    @Test
    void registrationRejectsSurroundingWhitespaceInsteadOfTrimmingIt() {
        assertThatThrownBy(() -> this.userIds.normalizeForRegistration(" hero"))
                .isInstanceOf(WebApplicationException.class);
        assertThatThrownBy(() -> this.userIds.normalizeForRegistration("hero "))
                .isInstanceOf(WebApplicationException.class);
    }

    @Test
    void registrationRejectsReservedIdentifiersCaseInsensitively() {
        assertThatThrownBy(() -> this.userIds.normalizeForRegistration("user123"))
                .isInstanceOf(WebApplicationException.class);
        assertThatThrownBy(() -> this.userIds.normalizeForRegistration("ADMIN"))
                .isInstanceOf(WebApplicationException.class);
        assertThatThrownBy(() -> this.userIds.normalizeForRegistration("System"))
                .isInstanceOf(WebApplicationException.class);
    }

    @Test
    void lookupTrimsAndLowercasesWithoutValidatingTheLegacyFormat() {
        assertThat(this.userIds.normalizeForLookup(" Hero123 ")).isEqualTo("hero123");
        assertThat(this.userIds.normalizeForLookup("hero-123")).isEqualTo("hero-123");
        assertThat(this.userIds.normalizeForLookup("  ")).isNull();
        assertThat(this.userIds.normalizeForLookup(null)).isNull();
    }
}
