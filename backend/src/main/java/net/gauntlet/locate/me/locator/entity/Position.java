//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.entity;

import java.time.Instant;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Entity
@Table(name = "positions")
public class Position {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @NotBlank
    @Size(max = 32)
    @Column(name = "user_id", length = 32, nullable = false)
    String userId;

    @Column(nullable = false)
    double latitude;

    @Column(nullable = false)
    double longitude;

    Double accuracy;

    @Size(max = 255)
    @Column(name = "display_name", length = 255)
    String displayName;

    Float temperature;

    @Column(name = "weather_code")
    WeatherCode weatherCode;

    @NotNull
    @Column(nullable = false)
    Instant timestamp;

    @Size(max = 255)
    @Column(name = "osm_category", length = 255)
    String osmCategory;

    @Size(max = 255)
    @Column(name = "osm_type", length = 255)
    String osmType;

    @Size(max = 255)
    @Column(name = "osm_name", length = 255)
    String osmName;

    @Size(max = 255)
    @Column(name = "address_type", length = 255)
    String addressType;

    @Size(max = 255)
    @Column(name = "house_number", length = 255)
    String houseNumber;

    @Size(max = 255)
    @Column(name = "road", length = 255)
    String road;

    @Size(max = 255)
    @Column(name = "city", length = 255)
    String city;

    @Size(max = 255)
    @Column(name = "country", length = 255)
    String country;

    public Position() {
    }

    public Long id() {
        return this.id;
    }

    public Position id(Long id) {
        this.id = id;
        return this;
    }

    public String userId() {
        return this.userId;
    }

    public Position userId(String userId) {
        this.userId = userId;
        return this;
    }

    public double latitude() {
        return this.latitude;
    }

    public Position latitude(double latitude) {
        this.latitude = latitude;
        return this;
    }

    public double longitude() {
        return this.longitude;
    }

    public Position longitude(double longitude) {
        this.longitude = longitude;
        return this;
    }

    public Double accuracy() {
        return this.accuracy;
    }

    public Position accuracy(Double accuracy) {
        this.accuracy = accuracy;
        return this;
    }

    public String displayName() {
        return this.displayName;
    }

    public Position displayName(String displayName) {
        this.displayName = displayName;
        return this;
    }

    public Float temperature() {
        return this.temperature;
    }

    public Position temperature(Float temperature) {
        this.temperature = temperature;
        return this;
    }

    public WeatherCode weatherCode() {
        return this.weatherCode;
    }

    public Position weatherCode(WeatherCode weatherCode) {
        this.weatherCode = weatherCode;
        return this;
    }

    public Instant timestamp() {
        return this.timestamp;
    }

    public Position timestamp(Instant timestamp) {
        this.timestamp = timestamp;
        return this;
    }

    public String osmCategory() {
        return this.osmCategory;
    }

    public Position osmCategory(String osmCategory) {
        this.osmCategory = osmCategory;
        return this;
    }

    public String osmType() {
        return this.osmType;
    }

    public Position osmType(String osmType) {
        this.osmType = osmType;
        return this;
    }

    public String osmName() {
        return this.osmName;
    }

    public Position osmName(String osmName) {
        this.osmName = osmName;
        return this;
    }

    public String addressType() {
        return this.addressType;
    }

    public Position addressType(String addressType) {
        this.addressType = addressType;
        return this;
    }

    public String houseNumber() {
        return this.houseNumber;
    }

    public Position houseNumber(String houseNumber) {
        this.houseNumber = houseNumber;
        return this;
    }

    public String road() {
        return this.road;
    }

    public Position road(String road) {
        this.road = road;
        return this;
    }

    public String city() {
        return this.city;
    }

    public Position city(String city) {
        this.city = city;
        return this;
    }

    public String country() {
        return this.country;
    }

    public Position country(String country) {
        this.country = country;
        return this;
    }

    public JsonObject toJSON() {
        JsonObjectBuilder builder = Json.createObjectBuilder();
        if (this.id != null) {
            builder.add("id", this.id);
        }
        builder.add("userId", this.userId != null ? this.userId : "")
               .add("latitude", this.latitude)
               .add("longitude", this.longitude);
        
        if (this.accuracy != null) {
            builder.add("accuracy", this.accuracy);
        }
        
        if (this.displayName != null) {
            builder.add("displayName", this.displayName);
        }
        
        if (this.temperature != null) {
            builder.add("temperature", this.temperature);
        }

        if (this.weatherCode != null) {
            builder.add("weatherCode", this.weatherCode.code());
        }
        
        if (this.timestamp != null) {
            builder.add("timestamp", this.timestamp.toString());
        }

        if (this.osmCategory != null) {
            builder.add("osmCategory", this.osmCategory);
        }
        if (this.osmType != null) {
            builder.add("osmType", this.osmType);
        }
        if (this.osmName != null) {
            builder.add("osmName", this.osmName);
        }
        if (this.addressType != null) {
            builder.add("addressType", this.addressType);
        }
        if (this.houseNumber != null) {
            builder.add("houseNumber", this.houseNumber);
        }
        if (this.road != null) {
            builder.add("road", this.road);
        }
        if (this.city != null) {
            builder.add("city", this.city);
        }
        if (this.country != null) {
            builder.add("country", this.country);
        }
        
        return builder.build();
    }

    public static Position fromJSON(JsonObject json) {
        Position position = new Position();
        if (json.containsKey("id") && !json.isNull("id")) {
            position.id(json.getJsonNumber("id").longValue());
        }
        if (json.containsKey("userId") && !json.isNull("userId")) {
            position.userId(json.getString("userId"));
        }
        if (json.containsKey("latitude") && !json.isNull("latitude")) {
            position.latitude(json.getJsonNumber("latitude").doubleValue());
        }
        if (json.containsKey("longitude") && !json.isNull("longitude")) {
            position.longitude(json.getJsonNumber("longitude").doubleValue());
        }
        if (json.containsKey("accuracy") && !json.isNull("accuracy")) {
            position.accuracy(json.getJsonNumber("accuracy").doubleValue());
        }
        if (json.containsKey("displayName") && !json.isNull("displayName")) {
            position.displayName(json.getString("displayName"));
        }
        if (json.containsKey("temperature") && !json.isNull("temperature")) {
            position.temperature((float) json.getJsonNumber("temperature").doubleValue());
        }
        if (json.containsKey("weatherCode") && !json.isNull("weatherCode")) {
            position.weatherCode(WeatherCode.fromCode(json.getJsonNumber("weatherCode").intValue()));
        }
        if (json.containsKey("timestamp") && !json.isNull("timestamp")) {
            position.timestamp(Instant.parse(json.getString("timestamp")));
        }

        if (json.containsKey("osmCategory") && !json.isNull("osmCategory")) {
            position.osmCategory(json.getString("osmCategory"));
        }
        if (json.containsKey("osmType") && !json.isNull("osmType")) {
            position.osmType(json.getString("osmType"));
        }
        if (json.containsKey("osmName") && !json.isNull("osmName")) {
            position.osmName(json.getString("osmName"));
        }
        if (json.containsKey("addressType") && !json.isNull("addressType")) {
            position.addressType(json.getString("addressType"));
        }
        if (json.containsKey("houseNumber") && !json.isNull("houseNumber")) {
            position.houseNumber(json.getString("houseNumber"));
        }
        if (json.containsKey("road") && !json.isNull("road")) {
            position.road(json.getString("road"));
        }
        if (json.containsKey("city") && !json.isNull("city")) {
            position.city(json.getString("city"));
        }
        if (json.containsKey("country") && !json.isNull("country")) {
            position.country(json.getString("country"));
        }
        return position;
    }
}
