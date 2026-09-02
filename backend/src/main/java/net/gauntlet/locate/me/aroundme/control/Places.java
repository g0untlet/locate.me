//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.aroundme.control;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import ch.hsr.geohash.GeoHash;
import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import jakarta.json.JsonString;
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

    public record CityCount(String city, long places) {
    }

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
    @ConfigProperty(name = "aroundme.cache-radius")
    int cacheRadius;

    @Inject
    @ConfigProperty(name = "aroundme.exclude-categories")
    String excludeCategories;

    @Inject
    @ConfigProperty(name = "aroundme.max-places")
    int maxPlaces;

    @Inject
    @ConfigProperty(name = "aroundme.read-from-cache")
    boolean readFromCache;

    // Secondary categories from aroundme.exclude-categories that must not be
    // returned or stored. Lazily parsed once per Places instance.
    Set<String> excludedSecondaryCategories;

    @Inject
    @ConfigProperty(name = "geoapify.format")
    String format;

    @Inject
    @ConfigProperty(name = "geoapify.api-key")
    Optional<String> apiKey;

    // Top-level categories from geoapify.categories that may be used as a place's
    // primary/secondary category. Lazily parsed once per Places instance.
    Set<String> allowedTopLevelCategories;

    public long count() {
        LOG.log(System.Logger.Level.DEBUG, "Counting cached places");
        return this.em.createQuery("SELECT COUNT(p) FROM Place p", Long.class).getSingleResult();
    }

    public List<CityCount> countByCity() {
        LOG.log(System.Logger.Level.DEBUG, "Counting cached places per city");
        return this.em.createQuery(
                "SELECT p.city, COUNT(p) FROM Place p WHERE p.city IS NOT NULL GROUP BY p.city ORDER BY p.city",
                Object[].class)
                .getResultList().stream()
                .map(row -> new CityCount((String) row[0], (Long) row[1]))
                .toList();
    }

    public List<Place> findNear(double lat, double lon, String acceptLanguage) {
        // Cache-first path: serve places within the geobox from the H2 cache. With
        // aroundme.read-from-cache disabled the cache is still written by
        // fetchAndStore, but never read – every request hits Geoapify fresh.
        if (this.readFromCache) {
            LOG.log(System.Logger.Level.DEBUG, "Looking up cached places near ({0}, {1})", lat, lon);
            List<Place> cached = findCached(lat, lon);
            if (!cached.isEmpty()) {
                LOG.log(System.Logger.Level.DEBUG, "Cache hit: returning {0} place(s) from the H2 cache", cached.size());
                return cached.stream().limit(this.maxPlaces).toList();
            }
        } else {
            LOG.log(System.Logger.Level.INFO, "Cache read disabled (aroundme.read-from-cache=false) – skipping the places cache");
        }

        // The client only displays aroundme.max-places entries; cache storage is
        // not affected (geoapify.limit still governs how many are persisted).
        return fetchAndStore(lat, lon, acceptLanguage).stream().limit(this.maxPlaces).toList();
    }

    private List<Place> findCached(double lat, double lon) {
        if (this.cacheRadius <= 0) {
            return List.of();
        }
        double deltaLat = Geoboxing.deltaLat(this.cacheRadius);
        double deltaLon = Geoboxing.deltaLon(this.cacheRadius, lat);
        List<Place> candidates = this.em.createQuery(
                "SELECT p FROM Place p WHERE p.latitude BETWEEN :minLat AND :maxLat "
                        + "AND p.longitude BETWEEN :minLon AND :maxLon",
                Place.class)
                .setParameter("minLat", lat - deltaLat)
                .setParameter("maxLat", lat + deltaLat)
                .setParameter("minLon", lon - deltaLon)
                .setParameter("maxLon", lon + deltaLon)
                .getResultList();

        return candidates.stream()
                .map(p -> new NearPlace(p, Geoboxing.distanceMeters(lat, lon, p.latitude(), p.longitude())))
                .filter(np -> np.distance() <= this.cacheRadius)
                .filter(np -> !isExcluded(np.place()))
                .sorted(Comparator.comparingDouble(NearPlace::distance).thenComparing(np -> np.place().placeId()))
                .limit(this.limit)
                .map(NearPlace::place)
                .toList();
    }

    private List<Place> fetchAndStore(double lat, double lon, String acceptLanguage) {
        LOG.log(System.Logger.Level.DEBUG, "Fetching places from Geoapify near ({0}, {1})", lat, lon);
        String lang = ClientLanguage.fromAcceptLanguage(acceptLanguage);
        String filter = "circle:" + lon + "," + lat + "," + this.radius;
        String bias = "proximity:" + lon + "," + lat;

        JsonObject response;
        try {
            response = this.geoapifyPlacesClient.places(this.categories, filter, bias, this.limit, this.format, this.apiKey.orElse(""), lang);
        } catch (Exception e) {
            LOG.log(System.Logger.Level.WARNING, "Geoapify places request failed: {0}", e.getMessage());
            throw new WebApplicationException(Response.status(Response.Status.SERVICE_UNAVAILABLE)
                    .entity(Json.createObjectBuilder().add("error", "Failed to fetch places from Geoapify").build())
                    .type(MediaType.APPLICATION_JSON)
                    .build());
        }

        JsonArray features = null;
        if (response != null && response.containsKey("features") && !response.isNull("features")) {
            features = response.getJsonArray("features");
        }

        // Surface an empty/unexpected Geoapify response instead of silently
        // storing nothing – helps to spot e.g. a rejected request (bad API key).
        if (features == null || features.isEmpty()) {
            LOG.log(System.Logger.Level.WARNING, "Geoapify returned no places near ({0}, {1}): {2}", lat, lon, response);
        }

        List<Place> places = new ArrayList<>();
        if (features != null) {
            for (int i = 0; i < features.size(); i++) {
                Place place = toPlace(features.getJsonObject(i), lat, lon);
                if (!isExcluded(place)) {
                    places.add(this.em.merge(place));
                }
            }
        }

        List<Place> stored = places.stream()
                .map(p -> new NearPlace(p, Geoboxing.distanceMeters(lat, lon, p.latitude(), p.longitude())))
                .sorted(Comparator.comparingDouble(NearPlace::distance).thenComparing(np -> np.place().placeId()))
                .limit(this.limit)
                .map(NearPlace::place)
                .toList();

        LOG.log(System.Logger.Level.DEBUG, "Stored {0} place(s) in the H2 places cache", places.size());
        return stored;
    }

    private record NearPlace(Place place, double distance) {
    }

    private Place toPlace(JsonObject feature, double fetchLat, double fetchLon) {
        JsonObject props = feature.getJsonObject("properties");
        JsonArray coordinates = feature.getJsonObject("geometry").getJsonArray("coordinates");
        double lon = coordinates.getJsonNumber(0).doubleValue();
        double lat = coordinates.getJsonNumber(1).doubleValue();
        JsonArray rawCategories = props.getJsonArray("categories");
        // Only categories whose top level is part of geoapify.categories are used;
        // everything else (e.g. "access" / "access.yes") is ignored.
        List<String> categories = configuredOnly(rawCategories);

        Place place = new Place();
        place.placeId(string(props, "place_id"));
        place.cachedAt(Instant.now());
        place.geohash(GeoHash.withCharacterPrecision(lat, lon, 9).toBase32());
        place.latitude(lat);
        place.longitude(lon);
        // Record the origin of this fetch (the user's request lat/lon) so the
        // places cache can later be read coverage-aware.
        place.fetchLat(fetchLat);
        place.fetchLon(fetchLon);
        String primary = primaryCategory(categories);
        String secondary = secondaryCategory(primary, categories);
        place.name(PlaceNames.resolve(props, primary, secondary));
        place.primaryCategory(primary);
        place.secondaryCategory(secondary);
        place.formattedAddress(string(props, "formatted"));
        place.street(string(props, "street"));
        place.houseNumber(string(props, "housenumber"));
        place.postcode(string(props, "postcode"));
        place.city(string(props, "city"));
        place.country(string(props, "country"));
        place.phone(phone(props));
        place.website(string(props, "website"));
        place.openingHours(string(props, "opening_hours"));
        // wheelchair is not a configured top-level category, so it must be read
        // from the raw category list, not the filtered one.
        place.wheelchair(wheelchair(rawCategories));
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

    private Set<String> allowedCategories() {
        if (this.allowedTopLevelCategories == null) {
            this.allowedTopLevelCategories = Arrays.stream(this.categories.split(","))
                    .map(String::trim)
                    .filter(entry -> !entry.isEmpty())
                    .map(this::topLevel)
                    .collect(Collectors.toSet());
        }
        return this.allowedTopLevelCategories;
    }

    private String topLevel(String category) {
        int dot = category.indexOf('.');
        return dot > 0 ? category.substring(0, dot) : category;
    }

    private Set<String> excludedCategories() {
        if (this.excludedSecondaryCategories == null) {
            this.excludedSecondaryCategories = Arrays.stream(this.excludeCategories.split(","))
                    .map(String::trim)
                    .filter(entry -> !entry.isEmpty())
                    .collect(Collectors.toSet());
        }
        return this.excludedSecondaryCategories;
    }

    private boolean isExcluded(Place place) {
        String secondary = place.secondaryCategory();
        return secondary != null && excludedCategories().contains(secondary);
    }

    private List<String> configuredOnly(JsonArray categories) {
        if (categories == null) {
            return List.of();
        }
        Set<String> allowed = allowedCategories();
        return categories.stream()
                .map(JsonString.class::cast)
                .map(JsonString::getString)
                .filter(category -> allowed.contains(topLevel(category)))
                .toList();
    }

    private String primaryCategory(List<String> categories) {
        if (categories == null || categories.isEmpty()) {
            return null;
        }
        String first = categories.get(0);
        int dot = first.indexOf('.');
        return dot > 0 ? first.substring(0, dot) : first;
    }

    private String secondaryCategory(String primary, List<String> categories) {
        if (primary == null || categories == null) {
            return null;
        }
        String prefix = primary + ".";
        for (String category : categories) {
            if (category.startsWith(prefix)) {
                return category.substring(prefix.length());
            }
        }
        return null;
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
