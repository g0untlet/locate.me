//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.control;

/**
 * Provides geodesic distance and walking, biking, and driving travel time
 * calculations. Uses the Haversine formula for straight-line distance and
 * applies an empirical circuity factor to approximate real-world routes.
 */
public interface DistanceCalculator {

    double EARTH_RADIUS_KM = 6371.0;
    double CIRCUITY_FACTOR = 1.35;
    double WALKING_SPEED_KMH = 4.8;
    double BIKING_SPEED_KMH = 16.5;
    double BIKING_CIRCUITY_FACTOR = 1.25;
    double DRIVING_URBAN_SPEED_KMH = 30.0;
    double DRIVING_SUBURBAN_SPEED_KMH = 50.0;
    double DRIVING_HIGHWAY_SPEED_KMH = 80.0;
    double DRIVING_CIRCUITY_FACTOR = 1.3;
    double DRIVING_HIGHWAY_CIRCUITY_FACTOR = 1.25;
    double URBAN_DISTANCE_KM = 5.0;
    double SUBURBAN_DISTANCE_KM = 30.0;
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
        return travelTimeMinutes(distanceKm, WALKING_SPEED_KMH, CIRCUITY_FACTOR);
    }

    /**
     * Estimates cycling travel time from a straight-line distance.
     * Applies a circuity factor of 1.25 to account for real street networks
     * and assumes an average biking speed of 16.5 km/h.
     *
     * @param distanceKm straight-line distance in kilometers (e.g. from {@link #haversine})
     * @return estimated biking time in minutes
     */
    static double bikingTimeMinutes(double distanceKm) {
        return travelTimeMinutes(distanceKm, BIKING_SPEED_KMH, BIKING_CIRCUITY_FACTOR);
    }

    /**
     * Estimates driving time from a straight-line distance. The assumed speed
     * and circuity depend on the distance, which hints at the kind of road:
     * under 5 km urban traffic (30 km/h, factor 1.3), 5-30 km suburban
     * roads (50 km/h, factor 1.3), beyond 30 km highways (80 km/h, factor 1.25).
     *
     * @param distanceKm straight-line distance in kilometers (e.g. from {@link #haversine})
     * @return estimated driving time in minutes
     */
    static double drivingTimeMinutes(double distanceKm) {
        if (distanceKm < URBAN_DISTANCE_KM) {
            return travelTimeMinutes(distanceKm, DRIVING_URBAN_SPEED_KMH, DRIVING_CIRCUITY_FACTOR);
        }
        if (distanceKm <= SUBURBAN_DISTANCE_KM) {
            return travelTimeMinutes(distanceKm, DRIVING_SUBURBAN_SPEED_KMH, DRIVING_CIRCUITY_FACTOR);
        }
        return travelTimeMinutes(distanceKm, DRIVING_HIGHWAY_SPEED_KMH, DRIVING_HIGHWAY_CIRCUITY_FACTOR);
    }

    static double travelTimeMinutes(double distanceKm, double speedKmh, double circuityFactor) {
        return (distanceKm * circuityFactor / speedKmh) * MINUTES_PER_HOUR;
    }
}
