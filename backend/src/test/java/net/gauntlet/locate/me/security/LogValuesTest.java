//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LogValuesTest {

    @Test
    void replacesLineBreaksAndTabs() {
        assertThat(LogValues.safe("hero\r\nname\tend")).isEqualTo("hero??name?end");
    }

    @Test
    void capsOverlongValues() {
        String safe = LogValues.safe("x".repeat(100));

        assertThat(safe).hasSize(65).endsWith("…");
    }

    @Test
    void rendersNullAsLiteral() {
        assertThat(LogValues.safe(null)).isEqualTo("null");
    }
}
