//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
/**
 * The AroundMe Business Component fetches places of interest around a given
 * coordinate from the Geoapify Places API, caches them in the local database
 * (deduplicated by place_id) and serves them to clients. Coordinates are
 * provided per request; all other API parameters are configured externally.
 */
package net.gauntlet.locate.me.aroundme;
