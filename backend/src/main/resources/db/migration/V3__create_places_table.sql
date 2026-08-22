--==============================================================================
-- V3__create_places_table.sql
-- Caches places fetched from the Geoapify Places API. The table is a deduplicated
-- cache keyed by the Geoapify place_id: re-fetching the same POI upserts the row.
-- cached_at and geohash support future cache reads and range queries.
--
-- H2 2.4.240 regression (issue #4308): native enum CHECK(... IN(...)) constraints
-- are compiled against one session and crash inserts from newer sessions
-- (SQLState 23514). This schema deliberately contains NO enums and NO CHECK
-- constraints -- only the primary key, NOT NULL markers, and plain indexes.
--==============================================================================

CREATE TABLE places (
    place_id          VARCHAR(255) NOT NULL,
    cached_at         TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    geohash           VARCHAR(9) NOT NULL,

    -- Spatial Coordinates (for 50m bounding box / SQL range queries)
    latitude          FLOAT(53) NOT NULL,
    longitude         FLOAT(53) NOT NULL,

    -- Core POI & Address Attributes
    name              VARCHAR(255),
    primary_category   VARCHAR(255),
    secondary_category VARCHAR(255),
    formatted_address VARCHAR(512),
    street            VARCHAR(255),
    house_number      VARCHAR(64),
    postcode          VARCHAR(32),
    city              VARCHAR(255),
    country           VARCHAR(255),

    -- Additional POI Metadata
    phone             VARCHAR(64),
    website           VARCHAR(512),
    opening_hours     VARCHAR(512),
    wheelchair        VARCHAR(64),

    -- Full Raw Geoapify Feature Payload (for future schema adjustments)
    raw_json          CLOB,

    CONSTRAINT places_pk PRIMARY KEY (place_id)
);

-- Backs geohash-prefix area lookups.
CREATE INDEX idx_places_geohash ON places(geohash);

-- Backs lat/lon bounding-box range queries.
CREATE INDEX idx_places_coords ON places(latitude, longitude);
