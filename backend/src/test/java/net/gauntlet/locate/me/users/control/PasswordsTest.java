//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.control;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.ws.rs.WebApplicationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PasswordsTest {

    final Passwords passwords = new Passwords();

    @BeforeEach
    void configureFastHashing() {
        this.passwords.minLength = 8;
        this.passwords.maxLength = 32;
        this.passwords.bcryptCost = 4;
    }

    @Test
    void policyAcceptsTheBoundaries() {
        this.passwords.validate("abcdefgh");
        this.passwords.validate("a".repeat(32));
    }

    @Test
    void policyRejectsBlankShortAndOverlongPasswords() {
        assertThatThrownBy(() -> this.passwords.validate(null)).isInstanceOf(WebApplicationException.class);
        assertThatThrownBy(() -> this.passwords.validate("       ")).isInstanceOf(WebApplicationException.class);
        assertThatThrownBy(() -> this.passwords.validate("abcdefg")).isInstanceOf(WebApplicationException.class);
        assertThatThrownBy(() -> this.passwords.validate("a".repeat(33))).isInstanceOf(WebApplicationException.class);
    }

    @Test
    void passwordBeyondBcryptByteLimitIsRejectedInsteadOfTruncated() {
        // 25 euro signs are inside the 8-32 character policy but 75 UTF-8 bytes.
        String widePassword = "\u20AC".repeat(25);
        assertThat(widePassword.length()).isEqualTo(25);
        assertThatThrownBy(() -> this.passwords.validate(widePassword))
                .isInstanceOf(WebApplicationException.class);
    }

    @Test
    void hashesVerifyOnlyTheOriginalPassword() {
        String hash = this.passwords.hash("correct-horse");
        assertThat(hash).isNotEqualTo("correct-horse");
        assertThat(this.passwords.matches("correct-horse", hash)).isTrue();
        assertThat(this.passwords.matches("wrong-horse", hash)).isFalse();
        assertThat(this.passwords.matches("correct-horse", null)).isFalse();
    }

    @Test
    void dummyHashNeverMatchesAnAttemptedPassword() {
        assertThat(this.passwords.matches("anything", this.passwords.dummyHash())).isFalse();
        assertThat(this.passwords.matches(null, this.passwords.dummyHash())).isFalse();
    }
}
