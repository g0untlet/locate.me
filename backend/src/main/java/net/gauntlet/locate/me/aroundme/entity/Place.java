//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.aroundme.entity;

import java.time.Instant;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Entity
@Table(name = "places")
public class Place {

    @Id
    @NotBlank
    @Size(max = 255)
    @Column(name = "place_id", length = 255, nullable = false)
    String placeId;

    @NotNull
    @Column(name = "cached_at", nullable = false)
    Instant cachedAt;

    @NotBlank
    @Size(max = 9)
    @Column(nullable = false, length = 9)
    String geohash;

    @Column(nullable = false)
    double latitude;

    @Column(nullable = false)
    double longitude;

    // Fetch origin: the user's lat/lon where the Geoapify request that produced
    // this cache row was centered. Internal cache metadata – never serialized.
    @Column(name = "fetch_lat", nullable = false)
    double fetchLat;

    @Column(name = "fetch_lon", nullable = false)
    double fetchLon;

    @NotBlank
    @Size(max = 255)
    @Column(nullable = false, length = 255)
    String name;

    @Size(max = 255)
    @Column(name = "primary_category", length = 255)
    String primaryCategory;

    @Size(max = 255)
    @Column(name = "secondary_category", length = 255)
    String secondaryCategory;

    @Size(max = 512)
    @Column(name = "formatted_address", length = 512)
    String formattedAddress;

    @Size(max = 255)
    @Column(length = 255)
    String street;

    @Size(max = 64)
    @Column(name = "house_number", length = 64)
    String houseNumber;

    @Size(max = 32)
    @Column(length = 32)
    String postcode;

    @Size(max = 255)
    @Column(length = 255)
    String city;

    @Size(max = 255)
    @Column(length = 255)
    String country;

    @Size(max = 64)
    @Column(length = 64)
    String phone;

    @Size(max = 512)
    @Column(length = 512)
    String website;

    @Size(max = 512)
    @Column(name = "opening_hours", length = 512)
    String openingHours;

    @Size(max = 64)
    @Column(length = 64)
    String wheelchair;

    @Lob
    @Column(name = "raw_json")
    String rawJson;

    public Place() {
    }

    public String placeId() {
        return this.placeId;
    }

    public Place placeId(String placeId) {
        this.placeId = placeId;
        return this;
    }

    public Instant cachedAt() {
        return this.cachedAt;
    }

    public Place cachedAt(Instant cachedAt) {
        this.cachedAt = cachedAt;
        return this;
    }

    public String geohash() {
        return this.geohash;
    }

    public Place geohash(String geohash) {
        this.geohash = geohash;
        return this;
    }

    public double latitude() {
        return this.latitude;
    }

    public Place latitude(double latitude) {
        this.latitude = latitude;
        return this;
    }

    public double longitude() {
        return this.longitude;
    }

    public Place longitude(double longitude) {
        this.longitude = longitude;
        return this;
    }

    public double fetchLat() {
        return this.fetchLat;
    }

    public Place fetchLat(double fetchLat) {
        this.fetchLat = fetchLat;
        return this;
    }

    public double fetchLon() {
        return this.fetchLon;
    }

    public Place fetchLon(double fetchLon) {
        this.fetchLon = fetchLon;
        return this;
    }

    public String name() {
        return this.name;
    }

    public Place name(String name) {
        this.name = name;
        return this;
    }

    public String primaryCategory() {
        return this.primaryCategory;
    }

    public Place primaryCategory(String primaryCategory) {
        this.primaryCategory = primaryCategory;
        return this;
    }

    public String secondaryCategory() {
        return this.secondaryCategory;
    }

    public Place secondaryCategory(String secondaryCategory) {
        this.secondaryCategory = secondaryCategory;
        return this;
    }

    public String formattedAddress() {
        return this.formattedAddress;
    }

    public Place formattedAddress(String formattedAddress) {
        this.formattedAddress = formattedAddress;
        return this;
    }

    public String street() {
        return this.street;
    }

    public Place street(String street) {
        this.street = street;
        return this;
    }

    public String houseNumber() {
        return this.houseNumber;
    }

    public Place houseNumber(String houseNumber) {
        this.houseNumber = houseNumber;
        return this;
    }

    public String postcode() {
        return this.postcode;
    }

    public Place postcode(String postcode) {
        this.postcode = postcode;
        return this;
    }

    public String city() {
        return this.city;
    }

    public Place city(String city) {
        this.city = city;
        return this;
    }

    public String country() {
        return this.country;
    }

    public Place country(String country) {
        this.country = country;
        return this;
    }

    public String phone() {
        return this.phone;
    }

    public Place phone(String phone) {
        this.phone = phone;
        return this;
    }

    public String website() {
        return this.website;
    }

    public Place website(String website) {
        this.website = website;
        return this;
    }

    public String openingHours() {
        return this.openingHours;
    }

    public Place openingHours(String openingHours) {
        this.openingHours = openingHours;
        return this;
    }

    public String wheelchair() {
        return this.wheelchair;
    }

    public Place wheelchair(String wheelchair) {
        this.wheelchair = wheelchair;
        return this;
    }

    public String rawJson() {
        return this.rawJson;
    }

    public Place rawJson(String rawJson) {
        this.rawJson = rawJson;
        return this;
    }

    public JsonObject toJSON() {
        JsonObjectBuilder builder = Json.createObjectBuilder();
        if (this.placeId != null) {
            builder.add("placeId", this.placeId);
        }
        builder.add("cachedAt", this.cachedAt != null ? this.cachedAt.toString() : "")
               .add("geohash", this.geohash != null ? this.geohash : "")
               .add("latitude", this.latitude)
               .add("longitude", this.longitude);

        if (this.name != null) {
            builder.add("name", this.name);
        }
        if (this.primaryCategory != null) {
            builder.add("primaryCategory", this.primaryCategory);
        }
        if (this.secondaryCategory != null) {
            builder.add("secondaryCategory", this.secondaryCategory);
        }
        if (this.formattedAddress != null) {
            builder.add("formattedAddress", this.formattedAddress);
        }
        if (this.street != null) {
            builder.add("street", this.street);
        }
        if (this.houseNumber != null) {
            builder.add("houseNumber", this.houseNumber);
        }
        if (this.postcode != null) {
            builder.add("postcode", this.postcode);
        }
        if (this.city != null) {
            builder.add("city", this.city);
        }
        if (this.country != null) {
            builder.add("country", this.country);
        }
        if (this.phone != null) {
            builder.add("phone", this.phone);
        }
        if (this.website != null) {
            builder.add("website", this.website);
        }
        if (this.openingHours != null) {
            builder.add("openingHours", this.openingHours);
        }
        if (this.wheelchair != null) {
            builder.add("wheelchair", this.wheelchair);
        }
        return builder.build();
    }
}
