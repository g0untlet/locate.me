//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.entity;

/**
 * Authorization role of a user account. USER is the default for every account;
 * ADMIN is granted only by the administrative part of the application or by the
 * ops-controlled admin bootstrap. The shared demo user never holds a role.
 */
public enum UserRole {
    USER,
    ADMIN
}
