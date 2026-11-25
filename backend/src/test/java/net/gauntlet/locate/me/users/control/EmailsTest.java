//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.control;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.ws.rs.WebApplicationException;
import org.junit.jupiter.api.Test;

class EmailsTest {

    final Emails emails = new Emails();

    @Test
    void normalizationTrimsAndLowercases() {
        assertThat(this.emails.normalize("  Hero@Example.DE ")).isEqualTo("hero@example.de");
    }

    @Test
    void invalidOrMissingEmailsAreRejected() {
        assertThatThrownBy(() -> this.emails.normalize(null)).isInstanceOf(WebApplicationException.class);
        assertThatThrownBy(() -> this.emails.normalize("  ")).isInstanceOf(WebApplicationException.class);
        assertThatThrownBy(() -> this.emails.normalize("no-at-sign.example")).isInstanceOf(WebApplicationException.class);
        assertThatThrownBy(() -> this.emails.normalize("no-dot@example")).isInstanceOf(WebApplicationException.class);
        assertThatThrownBy(() -> this.emails.normalize("spaces in@example.de")).isInstanceOf(WebApplicationException.class);
    }

    @Test
    void overlongEmailsAreRejected() {
        String local = "a".repeat(250);
        assertThatThrownBy(() -> this.emails.normalize(local + "@example.de"))
                .isInstanceOf(WebApplicationException.class);
    }
}
