//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.system.control;

import java.time.Instant;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class SystemInfo {

    private static final System.Logger LOG = System.getLogger(SystemInfo.class.getName());

    private Instant startupTime;

    @ConfigProperty(name = "quarkus.application.name", defaultValue = "unknown")
    String artifactId;

    @ConfigProperty(name = "quarkus.application.version", defaultValue = "unknown")
    String version;

    void onStart(@Observes StartupEvent ev) {
        this.startupTime = Instant.now();
        LOG.log(System.Logger.Level.INFO, "Application starting at {0}", this.startupTime);
    }

    public JsonObject toJSON() {
        return Json.createObjectBuilder()
                .add("artifactId", this.artifactId)
                .add("version", this.version)
                .add("startupTime", this.startupTime.toString())
                .build();
    }
}
