--==============================================================================
-- V4__add_place_details_to_positions.sql
-- Snapshots the contact metadata of a place the user picked from "Places around
-- me" onto the saved position (phone, website, opening hours, wheelchair).
--
-- Why a snapshot instead of a foreign key to places: the places table is a cache
-- that is upserted on every Geoapify fetch (and can miss entirely when
-- aroundme.read-from-cache is off). A position must keep the details the user saw
-- at save time, exactly like displayName / road / city / weather already do.
--
-- Column names and lengths mirror places (V3) so one renderer serves both.
--==============================================================================

ALTER TABLE positions ADD COLUMN phone VARCHAR(64);
ALTER TABLE positions ADD COLUMN website VARCHAR(512);
ALTER TABLE positions ADD COLUMN opening_hours VARCHAR(512);
ALTER TABLE positions ADD COLUMN wheelchair VARCHAR(64);
