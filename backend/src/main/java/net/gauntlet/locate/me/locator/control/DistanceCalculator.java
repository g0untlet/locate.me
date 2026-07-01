//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.control;

/**
 * Provides geodesic distance and pedestrian travel time calculations.
 * Uses the Haversine formula for straight-line distance and applies an
 * empirical circuity factor to approximate real-world walking routes.
 */
public interface DistanceCalculator {

    double EARTH_RADIUS_KM = 6371.0;
    double CIRCUITY_FACTOR = 1.35;
    double WALKING_SPEED_KMH = 4.8;
    double MINUTES_PER_HOUR = 60.0;

    /**
     * Calculates the great-circle distance between two WGS-84 coordinates
     * using the Haversine formula.
     *
     * @return straight-line distance in kilometers
     */
    static double haversine(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }

    /**
     * Estimates pedestrian travel time from a straight-line distance.
     * Applies a circuity factor of 1.35 to account for real street networks
     * and assumes an average walking speed of 4.8 km/h.
     *
     * @param distanceKm straight-line distance in kilometers (e.g. from {@link #haversine})
     * @return estimated walking time in minutes
     */
    static double walkingTimeMinutes(double distanceKm) {
        return (distanceKm * CIRCUITY_FACTOR / WALKING_SPEED_KMH) * MINUTES_PER_HOUR;
    }
}
