//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.system.control;

import java.io.InputStream;
import java.time.Instant;
import java.util.Properties;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.json.Json;
import jakarta.json.JsonObject;

@ApplicationScoped
public class SystemInfo {

    private static final System.Logger LOG = System.getLogger(SystemInfo.class.getName());

    private Instant startupTime;
    private String version;
    private String artifactId;

    void onStart(@Observes StartupEvent ev) {
        this.startupTime = Instant.now();
        LOG.log(System.Logger.Level.INFO, "Application starting at {0}", this.startupTime);
        loadBuildInfo();
    }

    private void loadBuildInfo() {
        try (InputStream is = SystemInfo.class.getResourceAsStream("/build-info.properties")) {
            if (is != null) {
                Properties props = new Properties();
                props.load(is);
                this.version = props.getProperty("version", "unknown");
                this.artifactId = props.getProperty("artifactId", "unknown");
            } else {
                this.version = "unknown (dev)";
                this.artifactId = "unknown (dev)";
                LOG.log(System.Logger.Level.WARNING, "build-info.properties not found. Build info will be unavailable.");
            }
        } catch (Exception e) {
            LOG.log(System.Logger.Level.ERROR, "Could not load build info from build-info.properties", e);
            this.version = "error";
            this.artifactId = "error";
        }
    }

    public JsonObject toJSON() {
        return Json.createObjectBuilder()
                .add("artifactId", this.artifactId)
                .add("version", this.version)
                .add("startupTime", this.startupTime.toString())
                .build();
    }
}
