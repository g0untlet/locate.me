--==============================================================================
-- V6__add_auth_epoch_to_users.sql
-- Adds the per-account credential generation counter.
--
-- The counter is mirrored into the JWT as the "ver" claim. Changing a password
-- or an administrative password reset increments it, so every token issued
-- before the change is rejected on its next request (the token carries the old
-- generation). This is deliberately not a server-side token-revocation list:
-- it is one integer on the account, checked against the token after the account
-- has been loaded anyway. It also makes a compromise recovery complete --
-- deactivation blocks tokens while the account is DISABLED, and the increment
-- keeps them blocked after the account is reactivated.
--
-- Existing accounts start at 0 and keep any token they already hold.
--==============================================================================

ALTER TABLE users ADD COLUMN auth_epoch BIGINT NOT NULL DEFAULT 0;
