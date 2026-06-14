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
        return position;
    }
}
