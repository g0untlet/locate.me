//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
/**
 * The Game Business Component persists the best score of each user per game and
 * derives the community high score from those rows. It is deliberately
 * game-agnostic: {@code game} is a plain text key, so future Easter eggs can
 * reuse the same table and endpoints without a schema change or an enum value.
 */
package net.gauntlet.locate.me.game;
