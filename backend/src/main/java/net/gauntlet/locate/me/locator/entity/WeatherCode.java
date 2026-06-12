//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.entity;

public enum WeatherCode {
    CLEAR_SKY(0, "Wolkenlos / Klar"),
    MAINLY_CLEAR(1, "Überwiegend klar"),
    PARTLY_CLOUDY(2, "Teilweise bewölkt"),
    OVERCAST(3, "Bedeckt"),
    FOG(45, "Nebel"),
    DEPOSITING_RIME_FOG(48, "Raureifnebel"),
    LIGHT_DRIZZLE(51, "Leichter Sprühregen"),
    MODERATE_DRIZZLE(53, "Mäßiger Sprühregen"),
    DENSE_DRIZZLE(55, "Dichter Sprühregen"),
    LIGHT_FREEZING_DRIZZLE(56, "Leichter gefrierender Sprühregen"),
    DENSE_FREEZING_DRIZZLE(57, "Dichter gefrierender Sprühregen"),
    SLIGHT_RAIN(61, "Leichter Regen"),
    MODERATE_RAIN(63, "Mäßiger Regen"),
    HEAVY_RAIN(65, "Starker Regen"),
    LIGHT_FREEZING_RAIN(66, "Leichter gefrierender Regen"),
    HEAVY_FREEZING_RAIN(67, "Starker gefrierender Regen"),
    SLIGHT_SNOW_FALL(71, "Leichter Schneefall"),
    MODERATE_SNOW_FALL(73, "Mäßiger Schneefall"),
    HEAVY_SNOW_FALL(75, "Starker Schneefall"),
    SNOW_GRAINS(77, "Schneegriesel"),
    SLIGHT_RAIN_SHOWERS(80, "Leichte Regenschauer"),
    MODERATE_RAIN_SHOWERS(81, "Mäßige Regenschauer"),
    VIOLENT_RAIN_SHOWERS(82, "Starke Regenschauer"),
    SLIGHT_SNOW_SHOWERS(85, "Leichte Schneeschauer"),
    HEAVY_SNOW_SHOWERS(86, "Starke Schneeschauer"),
    THUNDERSTORM(95, "Gewitter"),
    THUNDERSTORM_SLIGHT_HAIL(96, "Gewitter mit leichtem Hagel"),
    THUNDERSTORM_HEAVY_HAIL(99, "Gewitter mit starkem Hagel"),
    UNKNOWN(-1, "Unbekannt");

    private final int code;
    private final String description;

    WeatherCode(int code, String description) {
        this.code = code;
        this.description = description;
    }

    public int code() {
        return this.code;
    }

    public String description() {
        return this.description;
    }

    public static WeatherCode fromCode(int code) {
        for (WeatherCode wc : values()) {
            if (wc.code == code) {
                return wc;
            }
        }
        return UNKNOWN;
    }
}
