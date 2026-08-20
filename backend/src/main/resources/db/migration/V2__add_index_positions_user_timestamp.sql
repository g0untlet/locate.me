--==============================================================================
-- V2__add_index_positions_user_timestamp.sql
-- Serves the history query pattern: WHERE user_id = ? ORDER BY timestamp DESC
-- (Positions.findByUserId). The composite index lets H2 satisfy both the filter
-- and the ordering from a single index scan.
--==============================================================================

CREATE INDEX idx_positions_user_timestamp ON positions (user_id, timestamp);