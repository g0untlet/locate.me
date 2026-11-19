//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.control;

/**
 * The single place that knows about the shared demo identity. The exception is
 * deliberately bound to the exact identifier: no other legacy user id may use
 * the unauthenticated demo path, and the demo user never receives a password,
 * a recovery email, a role or a JWT.
 */
public interface DemoUserPolicy {

    String DEMO_USER_ID = "user123";

    static boolean isDemo(String userId) {
        return DEMO_USER_ID.equals(userId);
    }
}
