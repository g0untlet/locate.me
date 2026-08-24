# Technical Landscape

## System Overview

### Purpose

Technical architecture of locate.me, a self-hosted geo-tracking PWA: a vanilla-JS
frontend records the current position together with weather, UV index, elevation and
address data enriched by a Quarkus backend. A POI ("places around me") capability
caches points of interest fetched from the Geoapify Places API and serves them
nearest-first. The functional scope is documented in
`docs/functional-scope.md`; this document covers the technical architecture only.

### Technology Stack

| Layer | Technology |
|---------|---------|
| Frontend | HTML5, Vanilla JavaScript (ES6 modules, no bundler), CSS3 (custom properties) |
| Frontend | Progressive Web App (PWA, installable) |
| Mapping | Leaflet 1.9.4 + OpenStreetMap tile server |
| Places | Geoapify Places API (POI discovery) |
| Backend | Quarkus 3.33.2, Java 21 |
| API | REST (Jakarta REST), JSON-B / JSON-P |
| ORM | Hibernate ORM (schema generation = `none`) |
| Migrations | Flyway (versioned SQL migrations, `quarkus-flyway`) |
| Persistence | H2 2.4.240 (file-based prod, in-memory dev/test) |
| Architecture | BCE (Boundary-Control-Entity) |
| Reverse Proxy | Caddy2, Debian Linux |

---

# Solution Architecture

## High-Level Architecture

```
Browser (PWA) --HTTPS--> Caddy2 --/api--> Quarkus REST (Boundary /api)
                                            |      |
                                            |   Control (business logic, enrichment)
                                            |      |
                                            |   Entity (Hibernate ORM)
                                            |      |
                                            |    H2 (file-based)
                                            |
       Quarkus --REST--> Open-Meteo    (temperature, weather code, UV index, elevation)
       Quarkus --REST--> Nominatim/OSM (reverse geocoding)
       Quarkus --REST--> Geoapify      (POI places around a coordinate)
       Browser --HTTPS--> OSM tile server (Leaflet map tiles)
```

- All REST endpoints live under `/api` (`@ApplicationPath("/api")`).
- The frontend reaches `/api` directly through the Caddy2 proxy; map tiles and the
  three enrichment APIs (Open-Meteo, Nominatim, Geoapify) are the only external calls.

---

# Frontend Architecture

## Application Type

- Single Page Application (SPA)
- PWA: installable via `manifest.json` with icons; service worker (`sw.js`) built on
  Workbox 7.3.0 (loaded from Google CDN), **Network-First** caching for `index.html`
  and same-origin JS/CSS. Online always serves fresh content; the cache is only a
  fallback for offline use. The two Leaflet CDN assets (JS/CSS) are cached as well so
  the map keeps working on pages loaded offline; map tiles are not cached.
  `skipWaiting` + `clientsClaim` let a new SW take control immediately;
  `activate` purges legacy caches.
- Precache on install: `sw.js` pre-populates `locateme-shell`/`locateme-assets` from a
  static `SHELL`/`ASSETS` manifest so the offline fallback exists after a single online
  visit. **Keep this manifest in sync** with the `?v=` cache-busters in `index.html` and
  the `js/` module tree (it is only a fallback — Network-First remains the serving
  strategy, so there is no staleness risk).
- History offline fallback: `GET /api/positions` is routed Network-First (cache
  `locateme-history`) with a per-user normalized cache key (pathname + `userId`,
  ignoring `lat`/`lon`). Cached responses carry the `X-LocateMe-Cache` header; the
  History page shows a slim offline banner when data comes from cache. Other API calls
  (POST/DELETE, `/positions/current`, `/system/info`) are not cached.
- Leaflet offline map: the cdnjs Leaflet JS/CSS are precached (`THIRD_PARTY`) and routed
  Network-First (`locateme-thirdparty`) so the global `L` stays defined on offline-loaded
  pages; `map.js` additionally guards all map init with `typeof L === 'undefined'` so a
  missing Leaflet degrades gracefully instead of crashing.

## Main Modules

| Module | Purpose |
|----------|----------|
| `app.js` | Entry point: bootstrap, tab navigation, backend status polling, service worker registration |
| `sw.js` | Service worker: Workbox Network-First caching (app shell, same-origin JS/CSS) |
| `js/config.js` | API base URL resolution (dev port vs. relative proxy paths) |
| `js/api.js` | Fetch wrappers for all REST endpoints |
| `js/state.js` | Central mutable state (maps, cached fix, history data) |
| `js/utils.js` | Formatting helpers (relative/weekday dates, address, weather text/icons, UV level, elevation, travel-time formatting + walk/bike/drive icons) |
| `js/ui/` | Reusable UI: `status.js`, `badge.js`, `toast.js`, `map.js` (Leaflet wrapper) |
| `js/pages/` | Screens: `locate.js`, `history.js`, `settings.js` (deps injected) |

## Navigation / Routing

- No URL router. Bottom navigation switches pages via `data-target` attributes;
  active tab state is managed in `app.js`.

## UI Components

| Component | Purpose |
|-----------|-----------|
| `status.js` | Backend reachability dot, inline errors, backend info (settings) |
| `badge.js` | Position count badge in the bottom navigation |
| `toast.js` | Transient status toasts |
| `map.js` | Shared Leaflet init, markers, popups, map sharing button |

## Browser Storage

| Storage | Usage |
|------------------|---------|
| Local Storage | `userId` (active user), `theme` (light/dark) |

---

# Backend Architecture

## Quarkus Version

Quarkus 3.33.2, Java 21, packaged as uber-jar (`locator-service-<version>-runner.jar`).

## Package Structure

```
net.gauntlet.locate.me
├── RestApplication.java        @ApplicationPath("/api")
├── locator/                    positions feature (BCE)
│   ├── boundary/   PositionsResource, DatabaseHealthCheck
│   ├── control/    Positions, DistanceCalculator, GeocodingClient, WeatherClient
│   └── entity/     Position, PositionTag, WeatherCode, WeatherCodeConverter
├── aroundme/                   places-around-me feature (BCE)
│   ├── boundary/   PlacesResource
│   ├── control/    Places, GeoapifyPlacesClient, Geoboxing, ClientLanguage, PlaceNames
│   └── entity/     Place
└── system/                     system info feature (BCE)
    ├── boundary/   SystemBoundary
    └── control/    SystemInfo
```

## Main Modules

| Module | Purpose |
|---------|---------|
| `locator` | Position lifecycle (create/read/delete), geocoding + weather enrichment, distance/travel-time (walking, biking, driving) |
| `aroundme` | Places around a coordinate: Geoapify fetch + H2 cache (cache-first geoboxing lookup, deduplicated by place_id), distance-sorted responses |
| `system` | Application info endpoint and startup timestamp |

---

# ECB Architecture

## Entity Components

| Entity | Responsibility |
|----------|----------|
| `Position` | Persistent business state; JSON mapping (`toJSON` / `fromJSON`) |
| `PositionTag` | Fixed tag vocabulary (enum) |
| `WeatherCode` | WMO weather-code vocabulary incl. German descriptions (enum) |
| `WeatherCodeConverter` | JPA AttributeConverter: `WeatherCode` ⇄ `Integer` (autoApply) |
| `Place` | Cached Geoapify POI; persistent business state; JSON mapping (`toJSON`) |

## Control Components

| Control | Responsibility |
|----------|----------|
| `Positions` | Orchestrates enrich (preview: geocoding + weather) and persist-only create, delete and queries; sole `EntityManager` access |
| `DistanceCalculator` | Haversine distance + walking/biking/driving time estimation (static util) |
| `SystemInfo` | Application metadata (artifactId, version, startupTime) |
| `GeocodingClient` | MicroProfile REST client → Nominatim reverse geocoding |
| `WeatherClient` | MicroProfile REST client → Open-Meteo forecast |
| `Places` | Cache-first lookup: geoboxing query (cache hit) or Geoapify fetch + upsert (miss); sole `EntityManager` access for places |
| `GeoapifyPlacesClient` | MicroProfile REST client → Geoapify Places API (`/v2/places`) |
| `Geoboxing` | Bounding-box spans (`deltaLat`/`deltaLon`) + haversine distance (static util) |
| `ClientLanguage` | `Accept-Language` → lowercased 2-letter ISO-639-1 code (static util) |
| `PlaceNames` | `name` fallback cascade for anonymous POIs (static util) |

## Boundary Components

| Boundary | Responsibility |
|----------|----------|
| `PositionsResource` | REST `/positions`: create, delete, list, current; validation + userId authorization |
| `SystemBoundary` | REST `/system` → `/info` |
| `DatabaseHealthCheck` | SmallRye readiness check (`SELECT 1`) |
| `PlacesResource` | REST `/places`: GET list (cache-first); validation + userId authorization; adds response-only `distance` |

### Rules

- Entities hold business state and JSON mapping; no UI, no REST logic.
- Controls orchestrate business logic, call REST clients and persist via `EntityManager`.
- Boundaries expose REST, validate/authorize and map request/response only.
- Marked via `@Boundary` / `@Control` stereotypes; package rule `{feature}.{boundary,control,entity}`.

---

# REST API Landscape

Root path is `/api`. Every positions call passes the user context as the `userId`
query parameter. Functional purpose of the endpoints is documented in
`functional-scope.md` §3.

## PositionsResource (`/positions`)

| Method | Endpoint | Notes |
|----------|----------|----------|
| GET | `/api/positions?userId=&lat=&lon=` | 200 list, newest first; optional `lat`/`lon` add response-only `distance` (km), `walkingTimeMinutes`, `bikingTimeMinutes`, `drivingTimeMinutes` |
| POST | `/api/positions?userId=` | 201 + `Location`; persists client-provided data verbatim (no server-side geocoding/weather resolution) |
| GET | `/api/positions/current?userId=&lat=&lon=` | 200 preview; geocoding + weather enrichment; not persisted |
| DELETE | `/api/positions/{id}?userId=` | 204 |

Common errors: 400 invalid/missing `userId` or body; 401 userId not in allow-list.

## SystemBoundary (`/system`)

| GET | `/api/system/info` | 200 `{artifactId, version, startupTime}` |

## PlacesResource (`/places`)

| Method | Endpoint | Notes |
|----------|----------|----------|
| GET | `/api/places?userId=&lat=&lon=` | 200 places cached around the coordinate, served nearest-first; the `Accept-Language` header (optional) selects the Geoapify `lang`; cache-first lookup via a geoboxing box (`aroundme.cache-radius`), Geoapify fetch + upsert on cache miss; each place includes a response-only `distance` (meters) |

Common errors: 400 invalid/missing `userId` or `lat`/`lon`; 401 userId not in allow-list; 503 Geoapify unavailable.

## Health & Tooling

- `GET /q/health/live`, `GET /q/health/ready` (SmallRye Health)
- `GET /q/swagger-ui` (OpenAPI)

---

# Data Model

## Entity: `Position` (table `positions`)

Single table, no relationships.

| Attribute (Java) | DB Column | DB Type | Notes |
|-------------|-------------|-------------|-------------|
| `id` Long | `id` | BIGINT identity | `@GeneratedValue` IDENTITY |
| `userId` String | `user_id` | VARCHAR(32) | not null |
| `latitude`, `longitude` double | `latitude`, `longitude` | DOUBLE | not null |
| `accuracy` Double | `accuracy` | DOUBLE | nullable |
| `displayName` String | `display_name` | VARCHAR(255) | |
| `temperature` Float | `temperature` | REAL | |
| `uvIndex` Float | `uv_index` | REAL | |
| `elevation` Float | `elevation` | REAL | |
| `weatherCode` | `weather_code` | INT | via `WeatherCodeConverter` |
| `timestamp` Instant | `timestamp` | TIMESTAMP | not null |
| `osmCategory` … `country` | `osm_category`, `osm_type`, `osm_name`, `address_type`, `house_number`, `road`, `city`, `country` | VARCHAR(255) | |
| `tag` PositionTag | `tag` | VARCHAR(32) | `@Enumerated(EnumType.STRING)`; since 0.4.0 the column is defined as `VARCHAR(32)` by the Flyway `V1__baseline.sql` — pre-0.4.0 databases had a native H2 `ENUM` that was converted to `VARCHAR` in 0.3.0 |
| `comment` String | `comment` | VARCHAR(255) | UI limit: 25 chars |

### Enumerations

- `WeatherCode`: numeric WMO codes; persisted as `Integer`.
- `PositionTag`: HOME, WORK, PARKING, SHOPPING, EATING, LEISURE, FRIENDS, HEALTH; persisted as String. Since 0.4.0 the schema is managed by Flyway and `V1__baseline.sql` defines `tag` as `VARCHAR(32)` directly, so changing the vocabulary no longer requires a column conversion. (Pre-0.4.0 databases had the column as an H2 native `ENUM`; it was converted with `ALTER TABLE positions ALTER COLUMN tag SET DATA TYPE VARCHAR(32) ...` in 0.3.0.)

## Entity: `Place` (table `places`)

Deduplicated cache of POIs fetched from the Geoapify Places API, keyed by the
Geoapify `place_id`; re-fetching the same POI updates the row.

| Attribute (Java) | DB Column | DB Type | Notes |
|-------------|-------------|-------------|-------------|
| `placeId` String | `place_id` | VARCHAR(255) | PK |
| `cachedAt` Instant | `cached_at` | TIMESTAMP(6) WITH TIME ZONE | not null; refreshed on every upsert |
| `geohash` String | `geohash` | VARCHAR(9) | not null; 9-char geohash via `ch.hsr:geohash` |
| `latitude`, `longitude` double | `latitude`, `longitude` | DOUBLE | not null |
| `name` String | `name` | VARCHAR(255) | not null; `PlaceNames` fallback cascade — never blank |
| `primaryCategory` String | `primary_category` | VARCHAR(255) | top-level segment of the first category |
| `secondaryCategory` String | `secondary_category` | VARCHAR(255) | first sub-category of the primary |
| `formattedAddress` String | `formatted_address` | VARCHAR(512) | |
| `street` String | `street` | VARCHAR(255) | |
| `houseNumber` String | `house_number` | VARCHAR(64) | |
| `postcode` String | `postcode` | VARCHAR(32) | |
| `city` String | `city` | VARCHAR(255) | |
| `country` String | `country` | VARCHAR(255) | |
| `phone` String | `phone` | VARCHAR(64) | |
| `website` String | `website` | VARCHAR(512) | |
| `openingHours` String | `opening_hours` | VARCHAR(512) | |
| `wheelchair` String | `wheelchair` | VARCHAR(64) | `yes` / `no` / null |
| `rawJson` String | `raw_json` | CLOB | full raw Geoapify feature payload (excluded from `toJSON()`) |

**Name resolution:** `name` is guaranteed non-blank. For anonymous POIs
`PlaceNames` builds a synthetic name from the category (secondary preferred, else
primary) plus the street (or city) context, falling back to `address_line1`,
`formatted`, then `"Unknown Place"`.

---

# Persistence

## Database

H2. Produktion: file-based `jdbc:h2:file:./data/locator;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE`;
DEV/tests: in-memory (`jdbc:h2:mem:locator_dev`, `jdbc:h2:mem:locator_test`). Credentials `sa`/`sa`.

## Tables

| Table | Purpose |
|---------|---------|
| `positions` | All saved positions |
| `places` | Deduplicated cache of Geoapify POIs (keyed by place_id) |
| `flyway_schema_history` | Flyway bookkeeping (applied migration versions/checksums) |

## Schema Management

Since 0.4.0 the schema is managed by **Flyway** (`quarkus-flyway`); Hibernate runs with
`quarkus.hibernate-orm.database.generation=none` and never alters the schema.

- Migrations are applied automatically at startup (`quarkus.flyway.migrate-at-start=true`).
- Migration scripts live in `backend/src/main/resources/db/migration/`:
  - `V1__baseline.sql` — snapshot of the 0.3.0 schema (extracted from the live DEV/PROD DBs).
  - `V2__add_index_positions_user_timestamp.sql` — composite index
    `idx_positions_user_timestamp (user_id, timestamp)` backing the history query
    `WHERE user_id = ? ORDER BY timestamp DESC` (see Data Access).
  - `V3__create_places_table.sql` — `places` POI cache table with the geohash and
    coordinate indexes (`idx_places_geohash`, `idx_places_coords`) backing the
    cache geoboxing lookup.
- **Existing databases** (DEV/PROD, already populated): on the first 0.4.0 start Flyway
  baselines them at version 1 (`quarkus.flyway.baseline-on-migrate=true`,
  `quarkus.flyway.baseline-version=1`). `V1__baseline.sql` is skipped and existing data is
  left untouched; only the `flyway_schema_history` table is added.
- **Fresh databases** (new file / in-memory test DB): Flyway applies `V1__baseline.sql`
  and then all later migrations.
- The integration-test suite runs all pending migrations against the in-memory H2 test
  database, validating the migration chain on the exact H2 version in use.

**Adding a migration**
1. Create `backend/src/main/resources/db/migration/V<next>__<description>.sql` with a
   version higher than the latest applied one (V1 is the immutable baseline).
2. Never modify an already-applied migration — Flyway verifies checksums and fails on
   drift (`flyway_schema_history` records checksums per version).
3. Flyway applies the new migration automatically at startup on all environments
   (local, DEV, PROD, tests).

**H2 2.4.240 regression (issue #4308):** native enum `CHECK(... IN(...))` constraints
are compiled against one H2 session and crash inserts from newer sessions
(SQLState 23514, "The database has been closed"). Constraint is therefore removed
from all live databases, and schema changes must never re-create native enum CHECKs
(rollout procedure: `docs/production-upgrade-0.3.0.md`).

## Data Access

No repository layer — control components use the Hibernate `EntityManager` directly
with parameterized JPQL (`findByUserId`, `findAll`, `find`/`remove`); SQL is never
built by string concatenation. The history query `findByUserId`
(`WHERE user_id = ? ORDER BY timestamp DESC`) is served by the composite index
`idx_positions_user_timestamp` defined in `V2__add_index_positions_user_timestamp.sql`.

The places cache is queried with a geoboxing range query
(`latitude`/`longitude` BETWEEN, served by `idx_places_coords`); the candidates
are then verified against the exact haversine distance (≤ `aroundme.cache-radius`),
sorted ascending and capped at `geoapify.limit` in memory (see `Places.findCached`).

---

# External Interfaces

## Incoming

| Interface | Protocol | Purpose |
|------------|------------|------------|
| REST API | HTTP/JSON | Frontend → Quarkus (via Caddy2) |
| Health endpoints | HTTP | Monitoring `/q/health/*` |

## Outgoing

| Interface | Protocol | Purpose |
|------------|------------|------------|
| Open-Meteo | REST/JSON | Current `temperature_2m`, `weather_code`, `uv_index`, `elevation` per position save |
| Nominatim (OSM) | REST/JSON | Reverse geocoding → display name + address parts |
| Geoapify | REST/JSON | POI places around a coordinate (categories, radius, limit, `lang`) |
| OSM tile server | HTTPS | Map tiles (browser-direct, Leaflet) |
| Google Maps | HTTPS | Share link from map popups (native share) |

---

# Security Architecture

## Authentication

None — private application for a trusted, small user base; not publicly exposed (Caddy2).

## Authorization

The `userId` query parameter is validated against `allowed.user.ids` (per profile,
overridable via env `ALLOWED_USER_IDS`): 400 on missing/non-alphanumeric/>16 chars,
401 on unknown user. The same `validateAndAuthorize` pattern is used by
`PositionsResource` and `PlacesResource`.

## Session Management

Stateless REST; no sessions.

## Data Protection

Parameterized JPQL only; database never exposed to clients; no secrets in the
frontend; TLS terminated by Caddy2. Coordinates are personal data — scope is
self-hosted and private.

---

# Build & Deployment

## Build Technology

Maven; Quarkus platform BOM 3.33.2; uber-jar artifact.

## Environment Overview

| Environment | Host | Port | Database |
|------------|------------|------------|------------|
| Local | dev machine | 8090 (`%dev`) | in-memory (`mvn quarkus:dev`) |
| DEV | 192.168.178.88 `~/homelab/locate.me.dev/` | 8090 | file `data/locator` |
| PROD | 192.168.178.88 `~/homelab/locate.me/` | 8080 | file `data/locator` |

## Deployment Flow

- `deploy-backend-dev.sh`: verifies a single JAR, cleans old JARs, `rsync`s it to DEV.
- `deploy-frontend-dev.sh`: `rsync -avz --delete` frontend → DEV.
- Server management: `start-locateme-backend.sh prod|dev` / `stop-locateme-backend.sh`
  set `ALLOWED_USER_IDS` + `QUARKUS_DATASOURCE_JDBC_URL` and restart the current JAR.
- Local helpers: `start-locate-tunnel.sh`, `start-h2-tunnel.sh` (SSH tunnels; H2 Shell/console).

## Configuration (application.properties)

| Property | Description |
|------------|------------|
| `quarkus.package.jar.type=uber-jar` | Single executable JAR |
| `quarkus.datasource.*` (`%dev`, `%test`) | H2 URLs + credentials |
| `quarkus.hibernate-orm.database.generation` | `none` (schema owned by Flyway) |
| `quarkus.flyway.migrate-at-start` | `true` — apply pending migrations on startup |
| `quarkus.flyway.baseline-on-migrate`, `quarkus.flyway.baseline-version` | `true` / `1` — baseline existing non-empty DBs at v1, skipping `V1__baseline.sql` |
| `allowed.user.ids` (+ `%dev`, `%test`) | Authorized users per profile |
| `nominatim_uri/mp-rest/url`, `weather_uri/mp-rest/url` | REST client base URLs |
| `geoapify_uri/mp-rest/url`, `geoapify.categories`, `geoapify.limit`, `geoapify.radius`, `geoapify.format`, `geoapify.api-key` | Geoapify Places client: base URL, category filter, result limit, fetch radius (m), format, API key (`${GEOAPIFY_API_KEY:}`) |
| `aroundme.cache-radius` | Cache bounding-box radius (m) for the cache-first lookup |
| `aroundme.exclude-categories` | Comma-separated secondary POI categories to exclude (e.g. `playground`); applied on cache hits and fresh fetches |
| `aroundme.max-places` | Maximum number of places returned for "Places around me" (default 7); `geoapify.limit` still controls the Geoapify fetch / cache size |
| `%dev.quarkus.http.port=8090` | DEV port |
| `quarkus.log.*` | Console DEBUG for project package |

---

# Quality Assurance

## Testing Strategy

| Test Type | Scope |
|------------|------------|
| Integration tests (IT) | REST + persistence + enrichment on in-memory H2 (`PositionsResourceIT`, incl. `createWithTagAndComment` and `createWithInvalidTag`; `PlacesResourceIT` — cache hit/miss, distance sorting, dedup, anonymous names, language) |
| Unit tests | `DistanceCalculatorTest`, `GeoboxingTest`, `ClientLanguageTest`, `PlaceNamesTest` |
| System tests (`backend-st`) | Run against a live backend on 8090 (`PositionsSystemIT` + `PositionsResourceClient`) |
| Manual E2E | Real devices/browsers against DEV (Android Chrome/Brave, iOS Safari) |

## Test Frameworks

| Framework | Usage |
|------------|------------|
| JUnit 5 (Quarkus Test) | Integration tests |
| RestAssured | REST assertions |
| AssertJ | Assertions |

---

# Technical Constraints

## Architecture

- BCE must be preserved (`boundary`/`control`/`entity` packages, stereotypes).
- REST API is the only public backend interface.
- Business logic resides in Controls; persistence is encapsulated in Controls.
- Frontend stays SPA/PWA; native ES6 modules, no bundler; Workbox service worker with
  Network-First caching (app shell + same-origin assets).

## Technology

- Quarkus 3.33.2, Java 21, H2 2.4.240.
- Caddy2 reverse proxy with HTTPS. All responses (static + `/api`) are sent with
  `Cache-Control: no-store` in every site block (DEV, PROD, `:8070` tunnel) — the
  browser HTTP cache is never used; `?v=` cache-busting query tokens remain as a
  safety net. The Workbox service worker's Cache Storage is independent of this
  header, so Network-First fallback caching works alongside `no-store`.
- HTTP/JSON communication; REST clients for Open-Meteo, Nominatim and Geoapify.
- Parameterized queries only — never SQL built from user input.
- H2 native enum CHECK constraints must not be (re-)created in the schema (2.4.240 regression; see Persistence).

---

# Technical Debt

| ID | Description | Priority |
|------|------|------|
| TD-001 | Schema managed by Hibernate `update`; fixes require manual per-DB constraint handling; no migration framework — **resolved in 0.4.0** (Flyway owns the schema, Hibernate `generation=none`) | Medium |

---

# Planned Technical Improvements

| ID | Description | Status |
|------|------|------|
| TI-001 | Adopt Flyway for versioned, explicit schema migrations (Hibernate `update` → `none`; existing DBs baselined at v1) | Done (0.4.0) |

---

# Change Log

| Version | Date | Description |
|---------|---------|---------|
| 0.4.0 | 2026-08-24 | Places around me: `geoapify.categories` extended with `entertainment,service`. `Places.toPlace` now filters the Geoapify `categories` array to the configured top-level categories before deriving `primary`/`secondary` (e.g. `access`/`access.yes` is ignored); `wheelchair` is still read from the raw list (`Places.configuredOnly`, `allowedCategories`). New `aroundme.exclude-categories` blocklist (`isExcluded`, `excludedCategories`) drops places by secondary category on both cache hits and fresh fetches. `Places.findNear` truncates to `aroundme.max-places` (7) while `geoapify.limit` still governs the Geoapify fetch / cache size. `Places.fetchAndStore` logs a WARNING when Geoapify returns no places (e.g. a rejected request). Frontend: `formatPlaceLabel` renders a selected place as `Name, street houseNumber` (chooser + saver + saved `osmName`, with `road`/`houseNumber`/`city`/`country` mapped); the green selection check-mark was removed (selection shown by highlight only); place icons for entertainment/service; the "Back" button was removed (Refresh restarts) and the Save button uses the standard primary style; button labels use Title Case. Locate view refinements: the chooser fills the page and only the places list shrinks/scrolls on small screens (`#places-card` flex + `.places-list` `flex:1; min-height:0; overflow-y:auto`); the resolved-address row reserves two lines (`#chooser-address-container` `min-height:2.8em`); a dedicated read-only "saved" view (`#locate-saved`) with its own Leaflet map (`showLocateSavedMap`, state `_locateSavedMap`/`_locateSavedMarker`, shared `renderLocateMap` helper in map.js) shows the persisted tag/comment/weather/location/elevation after saving. |
| 0.4.0 | 2026-08-23 | Frontend: Locate view integrated with the `aroundme` BC — after a GPS fix the view fetches `GET /positions/current` and `GET /api/places` in parallel and shows a two-step flow: a chooser (weather, selectable resolved address + elevation, the nearest places with distance) and a save step (Tag & Comment, weather, chosen location + elevation, Leaflet snippet, SAVE). Selecting a place only overrides the saved label (`osmName`/`displayName`/`city`/`country`); the GPS coordinates stay untouched. Places failures degrade to the address-only chooser. New frontend helpers: `formatDistanceMeters`, `getPlaceIconSvg` (utils.js) and `apiGetPlaces` (api.js). |
| 0.4.0 | 2026-08-23 | Config: `geoapify.radius` raised 50 m → 500 m so the "Places around me" list is usually populated in typical street settings; `aroundme.cache-radius` raised to 500 m to match the fetch radius so a repeat/nearby request is served from the H2 cache instead of re-fetching from Geoapify. |
| 0.4.0 | 2026-08-22 | New `aroundme` BC: `GET /places` fetches POIs from the Geoapify Places API and caches them in the new `places` table (Flyway `V3__create_places_table.sql`, deduplicated by `place_id`). Cache-first lookup via a configurable geobox (`aroundme.cache-radius`, default 500 m): on a hit results are served from H2, on a miss Geoapify is queried and the result is upserted; responses are sorted ascending by distance with a response-only `distance` (meters). The client's `Accept-Language` header is passed to Geoapify as `lang`. |
| 0.4.0 | 2026-08-22 | Anonymous POI handling: `places.name` is `NOT NULL` and guaranteed non-blank via a fallback cascade (`PlaceNames`) — `properties.name`, a synthetic `<Category> (<street|city>)` (secondary category preferred), `address_line1`, `formatted`, `Unknown Place`. |
| 0.4.0 | 2026-08-22 | `DatabaseHealthCheck` runs `SELECT 1` inside a transaction (`@Transactional`), fixing a `ContextNotActiveException` on vert.x worker threads. |
| 0.3.1 | 2026-08-21 | Frontend: offline map robustness — Leaflet CDN JS/CSS are now precached and routed Network-First (`locateme-thirdparty`) so `L` stays defined on pages loaded offline (fixes "Fetch Error: L is not defined" after offline load → online). `map.js` guards all map init with `typeof L === 'undefined'` to degrade gracefully. Cache-buster app.js `_33`. |
| 0.3.1 | 2026-08-21 | Frontend: history offline fallback — `GET /api/positions` served Network-First via the service worker (`locateme-history`, per-user normalized cache key ignoring lat/lon); cached responses flagged with `X-LocateMe-Cache` and shown via a slim offline banner in the History list. Other API calls remain uncached. Cache-busters bumped (css `_26`, app.js `_32`), version stays 0.3.1 / 20260821. |
| 0.3.1 | 2026-08-21 | Frontend: service worker (`sw.js`) reintroduced with Workbox 7.3.0 (Google CDN, no bundler); Network-First strategy for `index.html` and same-origin JS/CSS so the app always picks up fresh content online and only falls back to cache offline. `skipWaiting` + `clientsClaim`; `activate` purges legacy caches. Precache-on-install (`SHELL`/`ASSETS` manifest) populates the caches on first visit, so the offline fallback is reliable and independent of SW control timing. Caddy `no-store` unchanged (Cache Storage is independent). App version/build bumped to 0.3.1 / 20260821. |
| 0.4.0 | 2026-08-20 | Adopted Flyway for versioned schema migrations (`quarkus-flyway`); Hibernate `database.generation` switched `update` → `none`; existing DEV/PROD databases baselined at v1 (`V1__baseline.sql`), no data migration. |
| 0.4.0 | 2026-08-20 | Added `V2__add_index_positions_user_timestamp.sql` — composite index `idx_positions_user_timestamp (user_id, timestamp)` serving the `WHERE user_id = ? ORDER BY timestamp DESC` history query. |
| 0.3.0 | 2026-08-10 | Initial version (replaces the template placeholder) |
| 0.3.0 | 2026-08-10 | Save flow refactored: `Positions` control split into `enrich` (preview) and persist-only `create`; `POST /positions` no longer resolves geocoding/weather; `GET /positions/current` is the only enrichment path. |
| 0.3.0 | 2026-08-10 | Caching policy: Caddy sends `Cache-Control: no-store` on all environments (DEV/PROD/`:8070`); PWA always fetches fresh `index.html`/assets. |
| 0.3.0 | 2026-08-10 | GPS fast-fix tuning: target accuracy 15m → 30m, max wait 15s → 8s, fix timeout 12s → 8s, `maximumAge` 0 → 5s. |
| 0.3.0 | 2026-08-11 | Frontend: tag & comment save UI (disclosure toggle, single-select predefined tags, 25-char comment); tag/comment shown in the History list and at the top of the saved-location card. |
| 0.3.0 | 2026-08-11 | Tag vocabulary revised: `PositionTag` and `PREDEFINED_TAGS` aligned to `HOME, WORK, PARKING, SHOPPING, EATING, LEISURE, FRIENDS, HEALTH` (replaced `RESTAURANT`, `EDU`, `POI`). No data migration required. |
| 0.3.0 | 2026-08-11 | DB fix: converted the DEV `positions.tag` column from H2 native `ENUM` to `VARCHAR` — new tag values were rejected with HTTP 500 because the `ENUM` value list is baked in at column creation (Hibernate creates the column as native `ENUM` even with `@Enumerated(EnumType.STRING)`). |
| 0.3.0 | 2026-08-12 | `DistanceCalculator` extended with walking/biking/driving time estimation (Haversine + speed factors); `PositionsResource.enrichWithTravelTimes` adds response-only `distance`, `walkingTimeMinutes`, `bikingTimeMinutes`, `drivingTimeMinutes`. |
| 0.3.0 | 2026-08-12 | Frontend: History travel row with `formatTravelTime(minutes, compact)` and `getTravelIconSvg(mode)` (walk/sneaker, bike, car icons); distance and travel times in a dedicated always-aligned bottom row, compact `~Xh` format for distances > 100 km. |
| 0.3.0 | 2026-08-12 | Frontend: History-card refinements — distance rendered as a neutral chip and rounded compactly (`~109 km`) above 100 km; `formatRelativeDate` shows weekday names for the two days after yesterday; new `--card-border` CSS token (1.5px, light/dark) replaces the fainter `--border-color` on `.log-card`; `.log-card-temp .embedded-weather-icon` resized to 15px to match the UV pill. |
