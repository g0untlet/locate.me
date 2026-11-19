//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.control;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LegacyUsersTest {

    @Test
    void parsingTrimsAndDropsBlankEntries() {
        assertThat(LegacyUsers.parseIds(" a, ,b ,, c "))
                .containsExactly("a", "b", "c");
    }

    @Test
    void parsingCollapsesCaseInsensitiveDuplicatesAndKeepsTheFirstSpelling() {
        assertThat(LegacyUsers.parseIds("hero123,HERO123,Hero123"))
                .containsExactly("hero123");
    }

    @Test
    void parsingHandlesMissingConfiguration() {
        assertThat(LegacyUsers.parseIds(null)).isEmpty();
        assertThat(LegacyUsers.parseIds("   ")).isEmpty();
        assertThat(LegacyUsers.parseIds(",,")).isEmpty();
    }
}
