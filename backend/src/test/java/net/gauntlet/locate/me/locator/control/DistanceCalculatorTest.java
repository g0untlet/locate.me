//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.control;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class DistanceCalculatorTest {

    @Test
    void haversineIsZeroForIdenticalCoordinates() {
        double distance = DistanceCalculator.haversine(48.1351, 11.5820, 48.1351, 11.5820);
        assertThat(distance).isEqualTo(0.0, within(1e-9));
    }

    @Test
    void haversineReturnsApproximateMunichBerlinDistance() {
        double distance = DistanceCalculator.haversine(48.1351, 11.5820, 52.5200, 13.4050);
        assertThat(distance).isBetween(495.0, 515.0);
    }

    @Test
    void walkingTimeForOneKilometer() {
        assertThat(DistanceCalculator.walkingTimeMinutes(1.0)).isEqualTo(16.875, within(1e-9));
    }

    @Test
    void bikingTimeForOneKilometer() {
        assertThat(DistanceCalculator.bikingTimeMinutes(1.0)).isCloseTo(4.54545, within(1e-3));
    }

    @Test
    void drivingTimeUsesUrbanSpeedBelowFiveKilometers() {
        assertThat(DistanceCalculator.drivingTimeMinutes(1.0)).isEqualTo(2.6, within(1e-9));
        assertThat(DistanceCalculator.drivingTimeMinutes(4.9)).isEqualTo(12.74, within(1e-9));
    }

    @Test
    void drivingTimeUsesSuburbanSpeedFromFiveToThirtyKilometers() {
        assertThat(DistanceCalculator.drivingTimeMinutes(5.0)).isEqualTo(7.8, within(1e-9));
        assertThat(DistanceCalculator.drivingTimeMinutes(10.0)).isEqualTo(15.6, within(1e-9));
        assertThat(DistanceCalculator.drivingTimeMinutes(30.0)).isEqualTo(46.8, within(1e-9));
    }

    @Test
    void drivingTimeUsesHighwaySpeedAboveThirtyKilometers() {
        assertThat(DistanceCalculator.drivingTimeMinutes(30.1)).isCloseTo(28.21875, within(1e-9));
        assertThat(DistanceCalculator.drivingTimeMinutes(100.0)).isEqualTo(93.75, within(1e-9));
    }
}
