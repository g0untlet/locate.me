//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
/**
 * The Users Business Component owns the account lifecycle: the permanent
 * userId identity, the recovery email, credential and status state, roles,
 * registration, the one-time migration of legacy accounts, login and the
 * administrative account operations. It also decides what the shared demo
 * identity may do and resolves the authenticated caller of a request.
 *
 * <p>H2 is the authoritative store. The former {@code allowed.user.ids}
 * configuration is only a temporary bootstrap input.
 */
package net.gauntlet.locate.me.users;
