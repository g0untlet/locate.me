//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.control;

import java.util.List;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import net.gauntlet.locate.me.Control;
import net.gauntlet.locate.me.locator.entity.Position;

@Control
public class Positions {

    static final System.Logger LOG = System.getLogger(Positions.class.getName());

    @Inject
    EntityManager em;

    @Inject
    @RestClient
    GeocodingClient geocodingClient;

    @Inject
    @RestClient
    WeatherClient weatherClient;

    public Position create(Position position) {
        LOG.log(System.Logger.Level.DEBUG, "Creating position for user {0}", position.userId());
        if (position.displayName() == null || position.displayName().isBlank()) {
            try {
                jakarta.json.JsonObject response = this.geocodingClient.reverse(position.latitude(), position.longitude(), "jsonv2");
                if (response != null && response.containsKey("display_name") && !response.isNull("display_name")) {
                    String displayName = response.getString("display_name");
                    if (displayName != null && displayName.length() > 255) {
                        displayName = displayName.substring(0, 255);
                    }
                    position.displayName(displayName);
                }
            } catch (Exception e) {
                LOG.log(System.Logger.Level.WARNING, "Failed to resolve displayName via OSM Nominatim API: {0}", e.getMessage());
            }
        }

        try {
            jakarta.json.JsonObject response = this.weatherClient.forecast(position.latitude(), position.longitude(), "temperature_2m,weather_code");
            if (response != null && response.containsKey("current") && !response.isNull("current")) {
                jakarta.json.JsonObject current = response.getJsonObject("current");
                if (current.containsKey("temperature_2m") && !current.isNull("temperature_2m")) {
                    position.temperature((float) current.getJsonNumber("temperature_2m").doubleValue());
                }
                if (current.containsKey("weather_code") && !current.isNull("weather_code")) {
                    int code = current.getJsonNumber("weather_code").intValue();
                    position.weatherCode(net.gauntlet.locate.me.locator.entity.WeatherCode.fromCode(code));
                }
            }
        } catch (Exception e) {
            LOG.log(System.Logger.Level.WARNING, "Failed to resolve weather via Open-Meteo API: {0}", e.getMessage());
        }

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
}
