//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.aroundme.control;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import ch.hsr.geohash.GeoHash;
import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import jakarta.json.JsonValue;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import net.gauntlet.locate.me.Control;
import net.gauntlet.locate.me.aroundme.entity.Place;

@Control
public class Places {

    static final System.Logger LOG = System.getLogger(Places.class.getName());

    @Inject
    EntityManager em;

    @Inject
    @RestClient
    GeoapifyPlacesClient geoapifyPlacesClient;

    @Inject
    @ConfigProperty(name = "geoapify.categories")
    String categories;

    @Inject
    @ConfigProperty(name = "geoapify.limit")
    int limit;

    @Inject
    @ConfigProperty(name = "geoapify.radius")
    int radius;

    @Inject
    @ConfigProperty(name = "geoapify.format")
    String format;

    @Inject
    @ConfigProperty(name = "geoapify.api-key")
    Optional<String> apiKey;

    public List<Place> findNear(double lat, double lon) {
        LOG.log(System.Logger.Level.DEBUG, "Fetching places near ({0}, {1})", lat, lon);
        String filter = "circle:" + lon + "," + lat + "," + this.radius;
        String bias = "proximity:" + lon + "," + lat;

        JsonObject response;
        try {
            response = this.geoapifyPlacesClient.places(this.categories, filter, bias, this.limit, this.format, this.apiKey.orElse(""));
        } catch (Exception e) {
            LOG.log(System.Logger.Level.WARNING, "Geoapify places request failed: {0}", e.getMessage());
            throw new WebApplicationException(Response.status(Response.Status.SERVICE_UNAVAILABLE)
                    .entity(Json.createObjectBuilder().add("error", "Failed to fetch places from Geoapify").build())
                    .type(MediaType.APPLICATION_JSON)
                    .build());
        }

        List<Place> places = new ArrayList<>();
        if (response != null && response.containsKey("features") && !response.isNull("features")) {
            JsonArray features = response.getJsonArray("features");
            for (int i = 0; i < features.size(); i++) {
                JsonObject feature = features.getJsonObject(i);
                Place place = toPlace(feature);
                places.add(this.em.merge(place));
            }
        }
        return places;
    }

    private Place toPlace(JsonObject feature) {
        JsonObject props = feature.getJsonObject("properties");
        JsonArray coordinates = feature.getJsonObject("geometry").getJsonArray("coordinates");
        double lon = coordinates.getJsonNumber(0).doubleValue();
        double lat = coordinates.getJsonNumber(1).doubleValue();
        JsonArray categories = props.getJsonArray("categories");

        Place place = new Place();
        place.placeId(string(props, "place_id"));
        place.cachedAt(Instant.now());
        place.geohash(GeoHash.withCharacterPrecision(lat, lon, 9).toBase32());
        place.latitude(lat);
        place.longitude(lon);
        place.name(string(props, "name"));
        place.primaryCategory(primaryCategory(categories));
        place.formattedAddress(string(props, "formatted"));
        place.street(string(props, "street"));
        place.houseNumber(string(props, "housenumber"));
        place.postcode(string(props, "postcode"));
        place.city(string(props, "city"));
        place.country(string(props, "country"));
        place.phone(phone(props));
        place.website(string(props, "website"));
        place.openingHours(string(props, "opening_hours"));
        place.wheelchair(wheelchair(categories));
        place.rawJson(feature.toString());
        return place;
    }

    private String string(JsonObject object, String name) {
        if (object.containsKey(name) && !object.isNull(name)) {
            JsonValue value = object.get(name);
            if (value.getValueType() == JsonValue.ValueType.STRING) {
                return object.getString(name);
            }
        }
        return null;
    }

    private String primaryCategory(JsonArray categories) {
        if (categories == null || categories.isEmpty()) {
            return null;
        }
        String first = categories.getString(0);
        int dot = first.indexOf('.');
        return dot > 0 ? first.substring(0, dot) : first;
    }

    private String wheelchair(JsonArray categories) {
        if (categories == null) {
            return null;
        }
        for (int i = 0; i < categories.size(); i++) {
            String category = categories.getString(i);
            if ("wheelchair.yes".equals(category)) {
                return "yes";
            }
            if ("wheelchair.no".equals(category)) {
                return "no";
            }
        }
        return null;
    }

    private String phone(JsonObject props) {
        String phone = string(props, "phone");
        if (phone == null && props.containsKey("contact") && !props.isNull("contact")) {
            phone = string(props.getJsonObject("contact"), "phone");
        }
        return phone;
    }
}
