//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.control;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import jakarta.persistence.EntityManager;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import net.gauntlet.locate.me.Control;
import net.gauntlet.locate.me.locator.entity.Position;
import net.gauntlet.locate.me.locator.entity.WeatherCode;
import net.gauntlet.locate.me.security.ExternalApiRateLimits;

@Control
public class Positions {

    static final System.Logger LOG = System.getLogger(Positions.class.getName());

    // Mirrors the `display_name` column length in Position; the composed address
    // is built from parts that are each up to 255 characters long.
    static final int DISPLAY_NAME_MAX_LENGTH = 255;

    public record PositionCount(String userId, long locations) {
    }

    public record ForecastTimeslice(String time, Float temperature, WeatherCode weatherCode, Float uvIndex, Integer precipitationProbability, Boolean isDay) {

        public JsonObject toJSON() {
            JsonObjectBuilder builder = Json.createObjectBuilder();
            if (this.time != null) {
                builder.add("time", this.time);
            }
            if (this.temperature != null) {
                builder.add("temperature", this.temperature);
            }
            if (this.weatherCode != null) {
                builder.add("weatherCode", this.weatherCode.code());
            }
            if (this.uvIndex != null) {
                builder.add("uvIndex", this.uvIndex);
            }
            if (this.precipitationProbability != null) {
                builder.add("precipitationProbability", this.precipitationProbability);
            }
            if (this.isDay != null) {
                builder.add("isDay", this.isDay);
            }
            return builder.build();
        }
    }

    public record Current(Position position, List<ForecastTimeslice> forecast, Boolean isDay) {

        public JsonObject toJSON() {
            JsonArrayBuilder forecastBuilder = Json.createArrayBuilder();
            this.forecast.stream().map(ForecastTimeslice::toJSON).forEach(forecastBuilder::add);
            JsonObjectBuilder builder = Json.createObjectBuilder(this.position.toJSON())
                    .add("forecast", forecastBuilder);
            if (this.isDay != null) {
                builder.add("isDay", this.isDay);
            }
            return builder.build();
        }
    }

    @Inject
    EntityManager em;

    @Inject
    @RestClient
    GeocodingClient geocodingClient;

    @Inject
    ExternalApiRateLimits externalApiRateLimits;

    @Inject
    @ConfigProperty(name = "nominatim.format")
    String geocodingFormat;

    @Inject
    @ConfigProperty(name = "nominatim.zoom")
    int geocodingZoom;

    @Inject
    @ConfigProperty(name = "nominatim.layer", defaultValue = "address")
    String geocodingLayer;

    @Inject
    @RestClient
    WeatherClient weatherClient;

    @Inject
    @ConfigProperty(name = "weather.current-fields")
    String currentFields;

    @Inject
    @ConfigProperty(name = "weather.hourly-fields")
    String hourlyFields;

    @Inject
    @ConfigProperty(name = "weather.forecast-hours")
    int forecastHours;

    @Inject
    @ConfigProperty(name = "weather.timezone")
    String timezone;

    public Current enrich(Position position) {
        LOG.log(System.Logger.Level.DEBUG, "Enriching position for user {0}", position.userId());
        if (position.displayName() == null || position.displayName().isBlank()) {
            // Acquire outside the try/catch so an external-API rate limit
            // surfaces as 429 instead of being swallowed as a geocoding failure.
            this.externalApiRateLimits.acquireNominatim();
            try {
                JsonObject response = this.geocodingClient.reverse(position.latitude(), position.longitude(),
                        this.geocodingFormat, this.geocodingZoom, this.geocodingLayer);
                if (response != null) {
                    applyAddress(position, response);
                    position.osmCategory(response.getString("category", null));
                    position.osmType(response.getString("type", null));
                    position.addressType(response.getString("addresstype", null));
                    // `name` is deliberately ignored: at building granularity it is
                    // the POI (shop/restaurant) name, and POIs are covered by the
                    // Geoapify places. `osmName` stays reserved for a place the user
                    // picked explicitly, so reverse geocoding never stores a POI name.
                }
            } catch (Exception e) {
                LOG.log(System.Logger.Level.WARNING, "Failed to resolve displayName via OSM Nominatim API: {0}", e.getMessage());
            }
        }

        List<ForecastTimeslice> forecast = List.of();
        Boolean isDay = null;
        // Same as above: rate-limit rejection must not be treated as a weather failure.
        this.externalApiRateLimits.acquireWeather();
        try {
            JsonObject response = this.weatherClient.forecast(position.latitude(), position.longitude(),
                    this.currentFields, this.hourlyFields, this.forecastHours + 1, this.timezone);
            if (response != null && response.containsKey("current") && !response.isNull("current")) {
                JsonObject current = response.getJsonObject("current");
                if (current.containsKey("temperature_2m") && !current.isNull("temperature_2m")) {
                    position.temperature((float) current.getJsonNumber("temperature_2m").doubleValue());
                }
                if (current.containsKey("uv_index") && !current.isNull("uv_index")) {
                    position.uvIndex((float) current.getJsonNumber("uv_index").doubleValue());
                }
                if (current.containsKey("weather_code") && !current.isNull("weather_code")) {
                    int code = current.getJsonNumber("weather_code").intValue();
                    position.weatherCode(WeatherCode.fromCode(code));
                }
                if (current.containsKey("is_day") && !current.isNull("is_day")) {
                    isDay = current.getJsonNumber("is_day").intValue() != 0;
                }
            }
            if (response != null && response.containsKey("elevation") && !response.isNull("elevation")) {
                position.elevation((float) response.getJsonNumber("elevation").doubleValue());
            }
            forecast = this.forecastTimeslices(response);
        } catch (Exception e) {
            LOG.log(System.Logger.Level.WARNING, "Failed to resolve weather via Open-Meteo API: {0}", e.getMessage());
        }

        return new Current(position, forecast, isDay);
    }

    /**
     * Stores the structured address of a Nominatim reverse response and derives
     * the display label from it. A reverse request at building granularity answers
     * with the POI of that building (`category=shop`, `addresstype=shop`), so the
     * response's `display_name` starts with the shop or restaurant name even with
     * `layer=address`. Composing the label from the address parts keeps the shown
     * address and the tooltip free of POI names; `display_name` is used solely as
     * a fallback when no address part is available (e.g. a park or a motorway).
     */
    static void applyAddress(Position position, JsonObject response) {
        JsonObject address = response.containsKey("address") && !response.isNull("address")
                ? response.getJsonObject("address")
                : null;
        if (address != null) {
            position.houseNumber(address.getString("house_number", null));
            position.road(address.getString("road", null));
            // Rural addresses carry `town`/`village`/`municipality` instead of `city`.
            position.city(firstValue(address, "city", "town", "village", "municipality"));
            position.country(address.getString("country", null));
        }
        String addressLabel = composeAddress(position.road(), position.houseNumber(),
                position.city(), position.country());
        position.displayName(truncateDisplayName(
                addressLabel != null ? addressLabel : response.getString("display_name", null)));
    }

    static String composeAddress(String road, String houseNumber, String city, String country) {
        String street = Stream.of(road, houseNumber).filter(Positions::present).collect(Collectors.joining(" "));
        List<String> parts = Stream.of(street, city, country).filter(Positions::present).toList();
        return parts.isEmpty() ? null : String.join(", ", parts);
    }

    static String firstValue(JsonObject object, String... names) {
        return Stream.of(names)
                .map(name -> object.getString(name, null))
                .filter(Positions::present)
                .findFirst()
                .orElse(null);
    }

    static boolean present(String value) {
        return value != null && !value.isBlank();
    }

    static String truncateDisplayName(String displayName) {
        return displayName == null || displayName.length() <= DISPLAY_NAME_MAX_LENGTH
                ? displayName
                : displayName.substring(0, DISPLAY_NAME_MAX_LENGTH);
    }

    private List<ForecastTimeslice> forecastTimeslices(JsonObject response) {
        if (response == null || !response.containsKey("hourly") || response.isNull("hourly")) {
            return List.of();
        }
        JsonObject hourly = response.getJsonObject("hourly");
        JsonArray times = this.array(hourly, "time");
        JsonArray temperatures = this.array(hourly, "temperature_2m");
        JsonArray codes = this.array(hourly, "weather_code");
        JsonArray uvIndices = this.array(hourly, "uv_index");
        JsonArray precipitationProbabilities = this.array(hourly, "precipitation_probability");
        JsonArray isDays = this.array(hourly, "is_day");
        int slices = times == null ? 0 : times.size();
        // Open-Meteo's forecast_hours window starts at the current hour; skip that
        // (and anything earlier) so the preview shows only future hours. One extra
        // hour is requested so exactly weather.forecast-hours future slices remain.
        String currentHour = this.currentHour(response);
        List<ForecastTimeslice> forecast = new ArrayList<>(slices);
        for (int i = 0; i < slices; i++) {
            String time = this.stringValue(times, i);
            if (currentHour != null && time != null && time.compareTo(currentHour) <= 0) {
                continue;
            }
            forecast.add(new ForecastTimeslice(
                    time,
                    this.floatValue(temperatures, i),
                    this.weatherCode(codes, i),
                    this.floatValue(uvIndices, i),
                    this.intValue(precipitationProbabilities, i),
                    this.booleanValue(isDays, i)));
        }
        return forecast.stream().limit(this.forecastHours).toList();
    }

    private String currentHour(JsonObject response) {
        if (response == null || !response.containsKey("current") || response.isNull("current")) {
            return null;
        }
        JsonObject current = response.getJsonObject("current");
        if (!current.containsKey("time") || current.isNull("time")) {
            return null;
        }
        String time = current.getString("time");
        return time.length() >= 13 ? time.substring(0, 13) + ":00" : null;
    }

    private JsonArray array(JsonObject object, String name) {
        return object.containsKey(name) && !object.isNull(name) ? object.getJsonArray(name) : null;
    }

    private String stringValue(JsonArray array, int index) {
        return array != null && index < array.size() && !array.isNull(index) ? array.getString(index) : null;
    }

    private Float floatValue(JsonArray array, int index) {
        return array != null && index < array.size() && !array.isNull(index)
                ? (float) array.getJsonNumber(index).doubleValue()
                : null;
    }

    private Integer intValue(JsonArray array, int index) {
        return array != null && index < array.size() && !array.isNull(index) ? array.getJsonNumber(index).intValue() : null;
    }

    private Boolean booleanValue(JsonArray array, int index) {
        Integer value = this.intValue(array, index);
        return value != null ? value != 0 : null;
    }

    private WeatherCode weatherCode(JsonArray array, int index) {
        Integer code = this.intValue(array, index);
        return code != null ? WeatherCode.fromCode(code) : null;
    }

    public Position create(Position position) {
        LOG.log(System.Logger.Level.DEBUG, "Persisting position for user {0}", position.userId());
        this.em.persist(position);
        return position;
    }

    public void delete(Long id) {
        LOG.log(System.Logger.Level.DEBUG, "Deleting position with id {0}", id);
        Position position = this.em.find(Position.class, id);
        if (position != null) {
            this.em.remove(position);
        }
    }

    public List<Position> findByUserId(String userId) {
        LOG.log(System.Logger.Level.DEBUG, "Finding positions for user {0}", userId);
        return this.em.createQuery("SELECT p FROM Position p WHERE p.userId = :userId ORDER BY p.timestamp DESC", Position.class)
                .setParameter("userId", userId)
                .getResultList();
    }

    public List<Position> findAll() {
        LOG.log(System.Logger.Level.DEBUG, "Finding all positions");
        return this.em.createQuery("SELECT p FROM Position p ORDER BY p.timestamp DESC", Position.class)
                .getResultList();
    }

    public List<PositionCount> countByUser() {
        LOG.log(System.Logger.Level.DEBUG, "Counting positions per user");
        return this.em.createQuery("SELECT p.userId, COUNT(p) FROM Position p GROUP BY p.userId ORDER BY p.userId", Object[].class)
                .getResultList().stream()
                .map(row -> new PositionCount((String) row[0], (Long) row[1]))
                .toList();
    }
}
