//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.entity;

/**
 * Lifecycle state of a user account. Persisted as a string so the database stays
 * readable and a future rename of the enum does not silently change behaviour.
 * Only ACTIVE accounts may authenticate or use the legacy fallback.
 */
public enum UserStatus {
    ACTIVE,
    DISABLED
}
