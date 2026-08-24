//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.aroundme.control;

/**
 * Geoboxing calculations for the places cache lookup. The axis-aligned box is
 * the circumscribed square of the search circle: it never misses a place within
 * the radius, but its corners extend to sqrt(2) * radius, so candidates must be
 * verified against the exact haversine distance.
 */
public interface Geoboxing {

    double METERS_PER_DEGREE_LAT = 111_320.0;

    /**
     * Latitude span in degrees for a radius in meters. One degree of latitude
     * is approximately 111,320 m on average.
     */
    static double deltaLat(double radiusMeters) {
        return radiusMeters / METERS_PER_DEGREE_LAT;
    }

    /**
     * Longitude span in degrees for a radius in meters at the given latitude.
     * Degrees of longitude shrink with cos(lat); the cosine is clamped to a
     * small floor so the result stays finite near the poles.
     */
    static double deltaLon(double radiusMeters, double latitudeDegrees) {
        double cosLat = Math.max(Math.cos(Math.toRadians(latitudeDegrees)), 1e-9);
        return radiusMeters / (METERS_PER_DEGREE_LAT * cosLat);
    }

    /**
     * Great-circle distance in meters between two WGS-84 coordinates using the
     * Haversine formula.
     */
    static double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return 6_371_000.0 * c;
    }

    /**
     * Initial great-circle bearing from the first to the second coordinate,
     * in degrees measured clockwise from north, normalized to [0, 360).
     */
    static double bearingDegrees(double lat1, double lon1, double lat2, double lon2) {
        double phi1 = Math.toRadians(lat1);
        double phi2 = Math.toRadians(lat2);
        double dLon = Math.toRadians(lon2 - lon1);
        double y = Math.sin(dLon) * Math.cos(phi2);
        double x = Math.cos(phi1) * Math.sin(phi2)
                - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
        double theta = Math.toDegrees(Math.atan2(y, x));
        return (theta + 360.0) % 360.0;
    }

    /**
     * 8-point compass direction (N, NE, E, SE, S, SW, W, NW) for a bearing in
     * degrees, or an empty string when the bearing is undefined (same point).
     */
    static String compassPoint(double bearingDegrees) {
        if (Double.isNaN(bearingDegrees)) {
            return "";
        }
        int index = (int) Math.round(bearingDegrees / 45.0) % 8;
        return new String[]{"N", "NE", "E", "SE", "S", "SW", "W", "NW"}[index];
    }
}
