//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.aroundme.control;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class GeoboxingTest {

    @Test
    void deltaLatForSixtyMeters() {
        assertThat(Geoboxing.deltaLat(60.0)).isEqualTo(60.0 / 111_320.0, within(1e-12));
    }

    @Test
    void deltaLonAtEquatorEqualsDeltaLat() {
        assertThat(Geoboxing.deltaLon(60.0, 0.0)).isEqualTo(Geoboxing.deltaLat(60.0), within(1e-12));
    }

    @Test
    void deltaLonGrowsWithLatitude() {
        double atEquator = Geoboxing.deltaLon(60.0, 0.0);
        double atMunich = Geoboxing.deltaLon(60.0, 48.1356);
        assertThat(atMunich).isGreaterThan(atEquator);
        assertThat(atMunich).isEqualTo(60.0 / (111_320.0 * Math.cos(Math.toRadians(48.1356))), within(1e-12));
    }

    @Test
    void deltaLonStaysFiniteAtPoles() {
        assertThat(Geoboxing.deltaLon(60.0, 90.0)).isFinite();
        assertThat(Geoboxing.deltaLon(60.0, -90.0)).isFinite();
    }

    @Test
    void distanceIsZeroForIdenticalCoordinates() {
        assertThat(Geoboxing.distanceMeters(48.1351, 11.5820, 48.1351, 11.5820)).isEqualTo(0.0, within(1e-6));
    }

    @Test
    void distanceReturnsApproximateMunichBerlin() {
        double distance = Geoboxing.distanceMeters(48.1351, 11.5820, 52.5200, 13.4050);
        assertThat(distance).isBetween(495_000.0, 515_000.0);
    }

    @Test
    void distanceForSixtyMetersNorthPair() {
        double lat2 = 48.1351 + Geoboxing.deltaLat(60.0);
        assertThat(Geoboxing.distanceMeters(48.1351, 11.5820, lat2, 11.5820)).isCloseTo(60.0, within(0.5));
    }

    @Test
    void boxContainsCircleButCornerExceedsRadius() {
        double radius = 60.0;
        double dLat = Geoboxing.deltaLat(radius);
        double dLon = Geoboxing.deltaLon(radius, 48.1356);

        // Point due north at the radius: inside the box and at the radius.
        double northLat = 48.1356 + dLat;
        assertThat(Geoboxing.distanceMeters(48.1356, 11.6058, northLat, 11.6058)).isCloseTo(radius, within(0.5));

        // Corner point: within the box (0.75 of the half-extent on both axes)
        // but beyond the radius (sqrt(2) * radius).
        double cornerLat = 48.1356 + 0.75 * dLat;
        double cornerLon = 11.6058 + 0.75 * dLon;
        assertThat(Geoboxing.distanceMeters(48.1356, 11.6058, cornerLat, cornerLon)).isGreaterThan(radius);
    }

    @Test
    void distanceIsSymmetric() {
        double d1 = Geoboxing.distanceMeters(48.1351, 11.5820, 48.1400, 11.5900);
        double d2 = Geoboxing.distanceMeters(48.1400, 11.5900, 48.1351, 11.5820);
        assertThat(d1).isEqualTo(d2, within(1e-9));
    }

    @Test
    void distanceForSixtyMetersEastPair() {
        double lat = 48.1356;
        double lon1 = 11.6058;
        double lon2 = lon1 + Geoboxing.deltaLon(60.0, lat);
        assertThat(Geoboxing.distanceMeters(lat, lon1, lat, lon2)).isCloseTo(60.0, within(0.5));
    }

    @Test
    void distanceAcrossAntiMeridian() {
        double distance = Geoboxing.distanceMeters(0.0, 179.9999, 0.0, -179.9999);
        assertThat(distance).isLessThan(500.0);
    }

    @Test
    void deltaLatAndLonWithZeroRadiusReturnsZero() {
        assertThat(Geoboxing.deltaLat(0.0)).isEqualTo(0.0);
        assertThat(Geoboxing.deltaLon(0.0, 48.1356)).isEqualTo(0.0);
    }

    @Test
    void deltaValuesForNegativeRadiusAreNegative() {
        assertThat(Geoboxing.deltaLat(-50.0)).isNegative();
        assertThat(Geoboxing.deltaLon(-50.0, 48.1356)).isNegative();
    }
}
