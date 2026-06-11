//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.boundary;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.HealthCheckResponseBuilder;
import org.eclipse.microprofile.health.Readiness;

@Readiness
@ApplicationScoped
public class DatabaseHealthCheck implements HealthCheck {

    static final System.Logger LOG = System.getLogger(DatabaseHealthCheck.class.getName());

    @Inject
    EntityManager em;

    @Override
    public HealthCheckResponse call() {
        HealthCheckResponseBuilder responseBuilder = HealthCheckResponse.named("Database Connection Readiness Check");
        try {
            this.em.createNativeQuery("SELECT 1").getSingleResult();
            LOG.log(System.Logger.Level.DEBUG, "Database health check succeeded");
            return responseBuilder.up().build();
        } catch (Exception e) {
            LOG.log(System.Logger.Level.ERROR, "Database readiness check failed", e);
            return responseBuilder.down()
                    .withData("error", e.getMessage() != null ? e.getMessage() : "Unknown Connection Error")
                    .build();
        }
    }
}
