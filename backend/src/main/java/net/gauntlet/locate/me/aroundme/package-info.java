//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
/**
 * The AroundMe Business Component fetches places of interest around a given
 * coordinate from the Geoapify Places API, caches them in the local database
 * (deduplicated by place_id) and serves them to clients. Coordinates are
 * provided per request; all other API parameters are configured externally.
 * The configured category filter may contain "|"-separated groups: each group
 * is fetched with its own Geoapify request, and the results are combined and
 * ordered by distance before they are cached and returned.
 */
package net.gauntlet.locate.me.aroundme;
