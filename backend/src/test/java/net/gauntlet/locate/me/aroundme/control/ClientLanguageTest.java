//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.aroundme.control;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class ClientLanguageTest {

    @Test
    void missingHeaderFallsBackToEnglish() {
        assertThat(ClientLanguage.fromAcceptLanguage(null)).isEqualTo("en");
    }

    @Test
    void emptyHeaderFallsBackToEnglish() {
        assertThat(ClientLanguage.fromAcceptLanguage("")).isEqualTo("en");
        assertThat(ClientLanguage.fromAcceptLanguage("   ")).isEqualTo("en");
    }

    @Test
    void picksHighestWeightedLanguage() {
        assertThat(ClientLanguage.fromAcceptLanguage("de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7")).isEqualTo("de");
    }

    @Test
    void picksFirstLanguageWhenWeightsEqual() {
        assertThat(ClientLanguage.fromAcceptLanguage("de;q=0.9,en;q=0.9")).isEqualTo("de");
    }

    @Test
    void picksHigherWeightedLanguageNotInFirstPosition() {
        assertThat(ClientLanguage.fromAcceptLanguage("en;q=0.5,de;q=0.9")).isEqualTo("de");
    }

    @Test
    void stripsRegionalSubTagAndLowercases() {
        assertThat(ClientLanguage.fromAcceptLanguage("de-CH")).isEqualTo("de");
        assertThat(ClientLanguage.fromAcceptLanguage("FR-fr,fr;q=0.9")).isEqualTo("fr");
    }

    @Test
    void wildcardFallsBackToEnglish() {
        assertThat(ClientLanguage.fromAcceptLanguage("*")).isEqualTo("en");
        assertThat(ClientLanguage.fromAcceptLanguage("*,de;q=0.5")).isEqualTo("de");
    }

    @Test
    void unparseableHeaderFallsBackToEnglish() {
        assertThat(ClientLanguage.fromAcceptLanguage("garbage")).isEqualTo("en");
        assertThat(ClientLanguage.fromAcceptLanguage("de;q=abc")).isEqualTo("en");
    }
}
