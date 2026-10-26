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
    double DRIVING_CITY_SPEED_KMH = 22.0;
    double DRIVING_CRUISE_SPEED_KMH = 90.0;
    double DRIVING_SPEED_RAMP_KM = 24.0;
    double DRIVING_CIRCUITY_FACTOR = 1.35;
    double DRIVING_START_STOP_MINUTES = 0.5;
    double DRIVING_TRAFFIC_FACTOR = 1.08;
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
     * Estimates driving time from a straight-line distance.
     *
     * <p>Unlike walking and biking, the average speed of a car trip is not a
     * constant: it is dominated by the mix of roads the route uses, and that
     * mix depends on how far the trip goes. A 1 km errand never leaves the
     * city (22 km/h door to door, including lights and queues), a 200 km trip
     * is mostly motorway (90 km/h average, including ramps and roadworks), and
     * everything in between sits on a continuous curve. Charging a whole trip
     * at one band speed - the previous approach - made the estimate jump by
     * minutes at every band border and charged long trips as if they stayed
     * on suburban roads.
     *
     * <p>The curve therefore ramps the speed up with the trip length
     * ({@link #DRIVING_SPEED_RAMP_KM}), adds a fixed cost for getting in and
     * out of a parking space ({@link #DRIVING_START_STOP_MINUTES}) and applies
     * a congestion allowance on top of free-flow routing
     * ({@link #DRIVING_TRAFFIC_FACTOR}), since a route planner's free-flow
     * time is the optimistic case. The result is strictly monotone: a place
     * twice as far away is always at least as far in minutes.
     *
     * <p>Constants were fitted against 84 reference routes in the Munich area
     * (relative least squares): ~23 % relative RMS error, ~6.5 min mean
     * absolute error. Road class cannot be derived from a distance, so a
     * distance-only estimate cannot beat that - use a routing service if the
     * exact duration matters.
     *
     * @param distanceKm straight-line distance in kilometers (e.g. from {@link #haversine})
     * @return estimated driving time in minutes
     */
    static double drivingTimeMinutes(double distanceKm) {
        if (distanceKm <= 0.0) {
            return 0.0;
        }
        return DRIVING_TRAFFIC_FACTOR
                * (DRIVING_START_STOP_MINUTES
                + travelTimeMinutes(distanceKm, drivingSpeedKmh(distanceKm), DRIVING_CIRCUITY_FACTOR));
    }

    /**
     * Average speed of a car trip of the given length: starts at the city
     * speed and approaches the cruise speed as the trip grows, never exceeding
     * it. Exponential rather than linear decay so the curve is smooth at every
     * distance and has no threshold to jump at.
     */
    private static double drivingSpeedKmh(double distanceKm) {
        return DRIVING_CITY_SPEED_KMH
                + (DRIVING_CRUISE_SPEED_KMH - DRIVING_CITY_SPEED_KMH)
                * (1.0 - Math.exp(-distanceKm / DRIVING_SPEED_RAMP_KM));
    }

    static double travelTimeMinutes(double distanceKm, double speedKmh, double circuityFactor) {
        return (distanceKm * circuityFactor / speedKmh) * MINUTES_PER_HOUR;
    }
}
