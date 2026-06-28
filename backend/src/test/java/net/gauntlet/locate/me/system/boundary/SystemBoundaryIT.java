//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.system.boundary;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;

import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
public class SystemBoundaryIT {

    @Test
    public void testGetInfo() {
        given()
          .when().get("/api/system/info")
          .then()
             .statusCode(200)
             .body("artifactId", is("locator-service"))
             .body("version", is("0.2.0"))
             .body("startupTime", notNullValue());
    }
}
