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
    void drivingTimeMatchesReferenceDistances() {
        // Anchors of the calibrated curve; 0 km must not cost anything.
        assertThat(DistanceCalculator.drivingTimeMinutes(0.0)).isZero();
        assertThat(DistanceCalculator.drivingTimeMinutes(0.5)).isCloseTo(2.409070, within(1e-6));
        assertThat(DistanceCalculator.drivingTimeMinutes(1.0)).isCloseTo(4.070962, within(1e-6));
        assertThat(DistanceCalculator.drivingTimeMinutes(5.0)).isCloseTo(13.113182, within(1e-6));
        assertThat(DistanceCalculator.drivingTimeMinutes(30.0)).isCloseTo(37.756202, within(1e-6));
        assertThat(DistanceCalculator.drivingTimeMinutes(100.0)).isCloseTo(98.892099, within(1e-6));
    }

    @Test
    void drivingTimeIsStrictlyMonotone() {
        // A place further away must never be faster: the old band model dropped
        // by five minutes at 5 km and by nineteen minutes at 30 km.
        double previous = 0.0;
        for (double km = 0.1; km <= 500.0; km += 0.1) {
            double minutes = DistanceCalculator.drivingTimeMinutes(km);
            assertThat(minutes).isGreaterThan(previous);
            previous = minutes;
        }
        assertThat(DistanceCalculator.drivingTimeMinutes(4.99))
                .isLessThan(DistanceCalculator.drivingTimeMinutes(5.0));
        assertThat(DistanceCalculator.drivingTimeMinutes(30.0))
                .isLessThan(DistanceCalculator.drivingTimeMinutes(30.01));
    }

    @Test
    void drivingTimeTendsToCruiseSpeedForLongDistances() {
        double minutesPerKm = (DistanceCalculator.drivingTimeMinutes(1010.0)
                - DistanceCalculator.drivingTimeMinutes(1000.0)) / 10.0;
        double cruiseMinutesPerKm = DistanceCalculator.DRIVING_CIRCUITY_FACTOR
                / DistanceCalculator.DRIVING_CRUISE_SPEED_KMH
                * DistanceCalculator.MINUTES_PER_HOUR
                * DistanceCalculator.DRIVING_TRAFFIC_FACTOR;
        assertThat(minutesPerKm).isCloseTo(cruiseMinutesPerKm, within(1e-3));
    }
}
