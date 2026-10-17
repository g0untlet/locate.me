//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.aroundme.control;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PlacesCategoryGroupsTest {

    @Test
    void parsesDelimiterSeparatedCategoryGroups() {
        Places places = places("catering,commercial | healthcare , leisure , entertainment");

        assertThat(places.categoryGroups())
                .containsExactly("catering,commercial", "healthcare,leisure,entertainment");
    }

    @Test
    void dropsEmptyGroupsAndCategories() {
        Places places = places("| catering,, commercial | | leisure, |");

        assertThat(places.categoryGroups()).containsExactly("catering,commercial", "leisure");
    }

    @Test
    void resultLimitScalesWithGroupCount() {
        Places places = places("catering|tourism.attraction|healthcare");
        places.maxPlaces = 20;

        assertThat(places.resultLimit()).isEqualTo(60);
    }

    @Test
    void allowedCategoriesContainTopLevelsFromEveryGroup() {
        Places places = places("catering,commercial|tourism.attraction|healthcare.pharmacy");

        assertThat(places.allowedCategories())
                .containsExactlyInAnyOrder("catering", "commercial", "tourism", "healthcare");
    }

    private Places places(String categories) {
        Places places = new Places();
        places.categories = categories;
        return places;
    }
}
