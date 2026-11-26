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
| Backend | Quarkus 3.33.3.1, Java 25 |
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
       Quarkus --REST--> Open-Meteo    (temperature, weather code, UV index, is_day, elevation, hourly forecast)
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
  ignoring `lat`/`lon`). The frontend keeps sending `?userId=` on this call even when a
  bearer token is present, purely so this key stays per-user (the backend ignores the
  parameter in that case). Cached responses carry the `X-LocateMe-Cache` header; the
  History page shows a slim offline banner when data comes from cache. Other API calls
  (POST/DELETE, `/positions/current`, `/system/info`) are not cached.
- Leaflet offline map: the cdnjs Leaflet JS/CSS are precached (`THIRD_PARTY`) and routed
  Network-First (`locateme-thirdparty`) so the global `L` stays defined on offline-loaded
  pages; `map.js` additionally guards all map init with `typeof L === 'undefined'` so a
  missing Leaflet degrades gracefully instead of crashing.

## Main Modules

| Module | Purpose |
|----------|----------|
| `app.js` | Entry point: bootstrap, tab navigation, backend status polling, install-prompt init, release-notes init, service worker registration |
| `sw.js` | Service worker: Workbox Network-First caching (app shell, same-origin JS/CSS) |
| `js/release-notes.js` | App-local latest-release notes (EN/DE/ES/FR) for the “What's new” dialog |
| `js/config.js` | API base URL resolution (dev port vs. relative proxy paths) |
| `js/auth.js` | Bearer-token session storage (`token`, `expiresAt`, `userId`); expired/malformed sessions and sessions of another identity are dropped |
| `js/api.js` | Fetch wrappers for all REST endpoints; adds the bearer token, keeps `?userId=` as the service-worker cache key and turns a 401 into the session-expired event; the public auth endpoints never send a token |
| `js/state.js` | Central mutable state (maps, cached fix, history data) |
| `js/utils.js` | Formatting helpers (relative/weekday dates, address, weather text/icons, UV level, elevation, travel-time formatting + walk/bike/drive icons), the shared place-detail renderer (`buildPlaceInfoRows` — phone/website/opening hours/wheelchair rows used by the saver card, the places-list accordion and the History card) plus `escapeHtml`, and compass helpers (`bearingDegrees`, `compassPoint`, `directionShort`, `directionName` — client-side port of the backend `Geoboxing`, localizes the 8-point direction; `arrowRotation`/`shortestPathRotation` for heading-relative arrow angles; `distanceMeters` haversine for the live-movement gate) |
| `js/ui/` | Reusable UI: `status.js`, `badge.js`, `toast.js`, `map.js` (Leaflet wrapper), `install.js` (PWA install banner / iOS hint), `compass.js` (shared device-heading source: `deviceorientation` + `deviceorientationabsolute` with tilt-compensated `computeYawDeg`, `subscribeHeading`/`getHeading`/`hasHeading`, `requestHeadingPermission` for the iOS motion-sensor gate), `release-notes.js` (once-per-version “What's new” dialog with first-launch and install-banner guards) |
| `js/pages/` | Screens: `locate.js`, `history.js`, `settings.js`, `auth.js` (claim/login/register/demo gate; deps injected) |

### Authentication gate (frontend)

On launch the app resolves the active `userId` from local storage. The shared demo
`user123` never prompts. A valid stored session opens the app directly; otherwise the
app asks `GET /auth/migration-status/{userId}` and opens the **claim** panel for an
unmigrated legacy account or the **login** panel for a migrated/registered one, with a
link to self-registration. **Not now** is offered only while the legacy fallback is
enabled and leaves the app on the `?userId=` path; the panel appears again on the next
launch. Registration (`POST /auth/register`) stores the returned token and makes the
chosen id the active identity.

Every 401 from a business endpoint clears the session and reopens the login panel
(expiry, password change or admin reset); the auth endpoints themselves are called
without a token, so a wrong password is a normal error. Both password fields have an
eye toggle (masked again when the panel opens or closes), and a rate-limited auth
request reports the `Retry-After` wait instead of a generic message. Settings still owns the
identity switch: changing the stored id clears the session and re-evaluates the gate,
and a Settings button opens the panel for demo users or to switch accounts. Business calls keep sending
`?userId=` **only** as the service-worker history cache key — the backend ignores it
when a bearer token is present.

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
| Local Storage | `userId` (active user), `theme` (light/dark), `locate-me.auth` (`{token, userId, expiresAt}` bearer session), `lang`, release-notes/install flags, `locate.me.lastFix.<userId>` |

---

# Backend Architecture

## Quarkus Version

Quarkus 3.33.3.1, Java 25, packaged as uber-jar (`locator-service-<version>-runner.jar`).

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
│   ├── control/    Places, GeoapifyPlacesClient, Geoboxing, ClientLanguage
│   └── entity/     Place
├── system/                     system info feature (BCE)
│   ├── boundary/   SystemBoundary
│   └── control/    SystemInfo
├── users/                      accounts + authentication feature (BCE)
│   ├── boundary/   AuthResource, UsersResource
│   ├── control/    UserAccounts, CurrentUser, LegacyUsers, LoginAttempts,
│   │               JwtTokens, Passwords, UserIds, Emails, DemoUserPolicy
│   └── entity/     User, UserRole, UserStatus
└── security/                   cross-cutting infrastructure (not a BCE component)
    UserIdIdentityResolver, TooManyRequestsMapper, ExternalApiRateLimits,
    AuthRateLimits, AuthErrors, AdminKeyVerifier
```

## Main Modules

| Module | Purpose |
|---------|---------|
| `locator` | Position lifecycle (create/read/delete), geocoding + weather enrichment, distance/travel-time (walking, biking, driving) |
| `aroundme` | Places around a coordinate: one Geoapify fetch per category group + H2 cache (cache-first geoboxing lookup, deduplicated by place_id), combined distance-sorted responses |
| `system` | Application info endpoint and startup timestamp |
| `users` | Account lifecycle and authentication: registration, one-time legacy migration (`claim`), login, password/role/status state, ADMIN account operations, the shared demo policy, the legacy `allowed.user.ids` bootstrap and stateless JWT issuance |
| `security` | Cross-cutting infrastructure: Bucket4j rate limiting (`UserIdIdentityResolver` segments the `pwa-*` buckets by token subject / `userId` query param / demo client address; `AuthRateLimits` protects the authentication endpoints; `TooManyRequestsMapper` custom 429 JSON body + `Retry-After` + INFO log), `AuthErrors` (shared JSON error shape) and `AdminKeyVerifier` (constant-time check of the `adminKey` query param against `admin.key` for the admin stats endpoints) |

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
| `User` | Account: permanent `userId` (PK) + mirrored `user_id_lower` (case-insensitive uniqueness/lookup), name, recovery email, bcrypt hash, status, roles (`@ElementCollection`, EAGER), failed-login counter, lock, timestamps and `@Version`; JSON-P allowlisting (`toJSON` / `fromJson` / `fromAdminJson`); transient write-only credential fields |
| `UserRole` | Authorization vocabulary (enum): USER, ADMIN — persisted as String |
| `UserStatus` | Account lifecycle (enum): ACTIVE, DISABLED — persisted as String |

## Control Components

| Control | Responsibility |
|----------|----------|
| `Positions` | Orchestrates enrich (preview: geocoding + current weather + short hourly forecast assembly) and persist-only create, delete, queries and per-user counts; sole `EntityManager` access. The address label is composed from the Nominatim address parts (road + house number, city with `town`/`village`/`municipality` fallback, country), so POI names from the geocoding response never reach the client; Nominatim's `name` is not stored as `osmName` (that field is reserved for user-picked Geoapify places) |
| `DistanceCalculator` | Haversine distance + walking/biking/driving time estimation (static util). Walking and biking use a fixed speed × circuity factor; driving uses a continuous speed curve that ramps from city speed (22 km/h) to cruise speed (90 km/h) over the trip length (24 km scale), plus a start/stop cost and a congestion allowance on top of free-flow routing — no distance bands, so the estimate is strictly monotone |
| `SystemInfo` | Application metadata (artifactId, version, startupTime) |
| `GeocodingClient` | MicroProfile REST client → Nominatim reverse geocoding (`format`, `zoom`, `layer` configurable) |
| `WeatherClient` | MicroProfile REST client → Open-Meteo forecast (current + `hourly`, `forecast_hours`, `timezone`) |
| `Places` | Cache-first lookup: geoboxing query (cache hit) or one Geoapify fetch per `\|`-separated category group + combined upsert (miss); discards features without a usable Geoapify name; deduplicates by place ID and sorts by distance; cache-entry count; sole `EntityManager` access for places |
| `GeoapifyPlacesClient` | MicroProfile REST client → Geoapify Places API (`/v2/places`) |
| `Geoboxing` | Bounding-box spans (`deltaLat`/`deltaLon`) + haversine distance (static util) |
| `ClientLanguage` | `Accept-Language` → lowercased 2-letter ISO-639-1 code (static util) |
| `UserAccounts` | Registration, one-time legacy claim, credential verification, profile/password/recovery-email changes, administrative password reset and ADMIN CRUD; explicit field allowlisting, optimistic-locking/unique-constraint conflicts → 409, last-active-admin guard |
| `CurrentUser` | Resolves the request identity: verified JWT `sub` → H2 user (must be ACTIVE), else the exact demo user, else an **unmigrated** legacy account while `auth.legacy-userid-auth=true`; keeps the former 400/401 contract of the position/place endpoints |
| `LegacyUsers` | Idempotent startup reconciliation of `allowed.user.ids` into unmigrated accounts and `auth.admin.user.ids` into ADMIN grants; never creates admins, never overwrites/deletes, skips the demo user |
| `LoginAttempts` | Persisted failure counter + progressive cooldown (`auth.login.*`), written in its own transaction so the 401 does not roll it back; success resets it |
| `JwtTokens` | Issues RS256 tokens (`sub`, `iat`, `exp`, `iss`, `aud`, `groups`, `ver`) and verifies the signing key at startup |
| `Passwords` | Policy (8–32 chars, 72 UTF-8 bytes) + bcrypt hash/verify + timing-equalizing dummy hash |
| `UserIds` | Registration rules (`[a-z0-9_-]{3,32}`, lowercased, reserved list) and case-insensitive lookup normalization that never rewrites a legacy id |
| `Emails` | Recovery-email trim/lowercase/format validation (≤254) |
| `DemoUserPolicy` | The single definition of the exact shared demo identity `user123` |

## Boundary Components

| Boundary | Responsibility |
|----------|----------|
| `PositionsResource` | REST `/positions`: create, delete, list, current, stats (admin); identity via `CurrentUser` (token subject, demo or unmigrated legacy id); delete is ownership-checked; adminKey check via `AdminKeyVerifier` |
| `SystemBoundary` | REST `/system` → `/info` |
| `DatabaseHealthCheck` | SmallRye readiness check (`SELECT 1`) |
| `PlacesResource` | REST `/places`: GET list (cache-first or grouped Geoapify fetch) and stats (admin); identity via `CurrentUser`; adminKey check via `AdminKeyVerifier`; adds response-only `distance` |
| `AuthResource` | REST `/auth`: register, login, legacy claim, migration-status; password-reset endpoints are 501 placeholders; rate limiting via `AuthRateLimits` |
| `UsersResource` | REST `/users`: self-service `/me` (profile, password, recovery email) requires a token; `/users[/{userId}]` CRUD requires ADMIN |

### Rules

- Entities hold business state and JSON mapping; no UI, no REST logic.
- Controls orchestrate business logic, call REST clients and persist via `EntityManager`.
- Boundaries expose REST, validate/authorize and map request/response only.
- Marked via `@Boundary` / `@Control` stereotypes; package rule `{feature}.{boundary,control,entity}`.

---

# REST API Landscape

Root path is `/api`. A normal user authenticates with `Authorization: Bearer <JWT>`
and the identity comes from the verified `sub` claim; the legacy `userId` query
parameter remains for the shared demo user and for legacy accounts that have not
been migrated yet (see Authentication). Functional purpose of the endpoints is
documented in `functional-scope.md` §3.

## PositionsResource (`/positions`)

| Method | Endpoint | Notes |
|----------|----------|----------|
| GET | `/api/positions?userId=&lat=&lon=` | 200 list, newest first; optional `lat`/`lon` add response-only `distance` (km), `walkingTimeMinutes`, `bikingTimeMinutes`, `drivingTimeMinutes`; optional fields (`tag`, `comment`, `phone`, `website`, `openingHours`, `wheelchair`) appear only when stored |
| POST | `/api/positions?userId=` | 201 + `Location`; persists client-provided data verbatim (no server-side geocoding/weather resolution), including the place-detail snapshot of an adopted place |
| GET | `/api/positions/current?userId=&lat=&lon=` | 200 preview; geocoding + weather enrichment (current incl. response-only `isDay`, plus a `forecast` array of the next `weather.forecast-hours` future hours — current hour skipped; each slice `time`, `temperature`, `weatherCode`, `uvIndex`, `precipitationProbability`, `isDay`); not persisted |
| DELETE | `/api/positions/{id}?userId=` | 204 |
| GET | `/api/positions/stats?adminKey=` | 200 `{"total", "perUser":[{"userId", "locations"}, ...]}` — total stored positions plus per-user counts (`perUser` ordered by `userId`); requires `adminKey` == `admin.key` (env `ADMIN_KEY`), otherwise 401; **not** rate-limited |

Common errors: 400 invalid/missing `userId` or body; 401 unknown user, migrated account without a token, or invalid/missing `adminKey` on `/stats`; 429 per-user rate limit exceeded (`pwa-critical`: writes/deletes) — `Retry-After` header + JSON body `{"error":"TOO_MANY_REQUESTS","status":429}`. With a valid token the `userId` query parameter is ignored, and `DELETE` only removes a position owned by the authenticated user.

## SystemBoundary (`/system`)

| GET | `/api/system/info` | 200 `{artifactId, version, startupTime}` — deliberately **not** rate-limited so the frontend health/status probe never trips a 429 |

## PlacesResource (`/places`)

| Method | Endpoint | Notes |
|----------|----------|----------|
| GET | `/api/places?userId=&lat=&lon=` | 200 places cached around the coordinate, served nearest-first; the `Accept-Language` header (optional) selects the Geoapify `lang`; cache-first lookup via a geoboxing box (`aroundme.cache-radius`), one Geoapify request per category group + combined upsert on cache miss; each place includes a response-only `distance` (meters) and `direction` (8-point compass `N/NE/E/SE/S/SW/W/NW`, empty when distance < 1 m) |
| GET | `/api/places/stats?adminKey=` | 200 `{"count", "perCity":[{"city", "places"}, ...]}` — places-cache entry count plus per-city breakdown (`perCity` ordered by `city`; places without a city count toward `count` but are omitted from `perCity`); requires `adminKey` == `admin.key` (env `ADMIN_KEY`), otherwise 401; **not** rate-limited |

Common errors: 400 invalid/missing `userId` or `lat`/`lon`; 401 unknown user or migrated account without a token (or invalid/missing `adminKey` on `/stats`); 429 per-user rate limit exceeded (`pwa-standard`: reads) — `Retry-After` header + JSON body `{"error":"TOO_MANY_REQUESTS","status":429}`; 503 Geoapify unavailable (all category-group requests failed).

## AuthResource (`/auth`, public)

| Method | Endpoint | Notes |
|----------|----------|----------|
| POST | `/api/auth/register` | 201 `{token, tokenType, userId, expiresAt}`; body reads only `userId`, `name`, `password`, `email`; 400 invalid/reserved/duplicate email, 409 duplicate `userId`; sets ACTIVE/USER and returns a JWT immediately |
| POST | `/api/auth/login` | 200 token envelope; reads only `userId`, `password`; 401 `Invalid credentials` for unknown, unmigrated, disabled, locked and wrong-password accounts; 429 rate limit |
| POST | `/api/auth/claim` | 200 token envelope; body reads `userId`, `password`, `email` and an optional `name` (display name); migrates an unmigrated legacy account once (identifier, roles and business data preserved); 403 demo/disabled, 404 unknown, 409 already migrated or email taken |
| GET | `/api/auth/migration-status/{userId}` | 200 `{"migrationRequired": bool}` — true only for an existing ACTIVE legacy account without a password (never the demo user, never an unknown id) |
| POST | `/api/auth/password-reset/request` | 501 `{"error":"Password reset is not available yet"}` (contract placeholder) |
| POST | `/api/auth/password-reset/confirm` | 501 (contract placeholder) |

## UsersResource (`/users`)

| Method | Endpoint | Notes |
|----------|----------|----------|
| GET | `/api/users/me` | 200 safe `User` projection incl. the non-sensitive `hasPassword` flag (no hash, counters, lock or version); requires a token |
| PUT | `/api/users/me` | 200; only `name` is read — `userId`, `email`, `status`, `roles` and security state in the body are ignored |
| PUT | `/api/users/me/password` | 204; `currentPassword` + `password` (optional `passwordConfirmation`), resets failed-login state |
| PUT | `/api/users/me/recovery-email` | 204; `currentPassword` + `email`, case-insensitive uniqueness |
| POST | `/api/users` | 201 (ADMIN); the only way to assign roles/status at creation |
| GET | `/api/users` | 200 list of safe projections incl. `hasPassword` (ADMIN) — the cutover view for who still needs to claim |
| GET | `/api/users/{userId}` | 200 / 404 (ADMIN), same projection |
| PUT | `/api/users/{userId}` | 200 (ADMIN); path id is the target, a conflicting body `userId` → 409, passwords are never changed here |
| PUT | `/api/users/{userId}/password` | 204 (ADMIN); body `password` (+ optional `passwordConfirmation`); hashes the new password, clears failed-login state and increments the credential generation, so all earlier tokens of that account are rejected. The support path for a forgotten password or lost recovery email |
| DELETE | `/api/users/{userId}` | 204 → status `DISABLED` (ADMIN); the last active administrator cannot be deactivated or demoted (409) |

Errors use the shared shape `{"error": "..."}`; JWT failures return 401, role failures 403, uniqueness/migration conflicts 409, authentication rate limits 429.

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
| `comment` String | `comment` | VARCHAR(255) | UI limit: 50 chars |
| `phone` String | `phone` | VARCHAR(64) | Snapshot of the adopted place's phone; empty for a plain GPS save |
| `website` String | `website` | VARCHAR(512) | Snapshot of the adopted place's website |
| `openingHours` String | `opening_hours` | VARCHAR(512) | Snapshot of the adopted place's opening hours |
| `wheelchair` String | `wheelchair` | VARCHAR(64) | Snapshot of the adopted place's wheelchair access (`yes`/`no`/`limited`/…) |

The four place-detail columns are a **snapshot**, deliberately not a foreign key to
`places`: that table is a cache that is upserted on every Geoapify fetch and may be
absent, so a reference would show today's cache row (or nothing) instead of what the
user saved. Names and lengths mirror `Place` so one frontend renderer serves both.

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
| `fetchLat`, `fetchLon` double | `fetch_lat`, `fetch_lon` | DOUBLE | not null; origin (user's request lat/lon) of the fetch that produced this cache row — set in `Places.toPlace`, excluded from `toJSON()`; supports coverage-aware cache reads later |
| `name` String | `name` | VARCHAR(255) | not null; Geoapify display name — features without a usable name are discarded |
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

**Name handling:** only Geoapify features with a non-blank `properties.name` are
imported. Unnamed POIs are skipped entirely (`Places.toPlace` returns `null` and
the fetch logs the skipped count at DEBUG), so `name` stays non-blank and no
synthetic fallback names are stored.

## Entity: `User` (table `users`)

Normal user account. The shared demo identity `user123` is deliberately **not** a
row; the legacy `allowed.user.ids` list is only bootstrap input.

| Attribute (Java) | DB Column | DB Type | Notes |
|-------------|-------------|-------------|-------------|
| `userId` String | `user_id` | VARCHAR(32) | PK; permanent identity and login name, never rewritten |
| `userIdLower` String | `user_id_lower` | VARCHAR(32) | not null, unique; lower-cased mirror for case-insensitive lookup/uniqueness |
| `name` String | `name` | VARCHAR(128) | optional display name |
| `email` String | `email` | VARCHAR(254) | unique, lower-cased; recovery address only, never a login name |
| `passwordHash` String | `password_hash` | VARCHAR(255) | bcrypt; `NULL` = unmigrated legacy account |
| `status` UserStatus | `status` | VARCHAR(32) | `ACTIVE` / `DISABLED`, string |
| `roles` Set\<UserRole\> | `user_roles` table | VARCHAR(32) | `@ElementCollection(EAGER)`, PK `(user_id, role)`, FK `ON DELETE CASCADE` |
| `failedLoginAttempts` int | `failed_login_attempts` | INTEGER | not null, default 0 |
| `lockedUntil` Instant | `locked_until` | TIMESTAMP(6) WITH TIME ZONE | temporary cooldown |
| `lastLoginAt` Instant | `last_login_at` | TIMESTAMP(6) WITH TIME ZONE | |
| `createdAt`/`updatedAt` Instant | `created_at`, `updated_at` | TIMESTAMP(6) WITH TIME ZONE | server-managed |
| `version` long | `entity_version` | BIGINT | `@Version` optimistic locking |
| `authEpoch` long | `auth_epoch` | BIGINT | credential generation mirrored into the JWT as `ver`; incremented by a password change or an administrative reset, which invalidates earlier tokens |

`positions.user_id` intentionally has **no** foreign key to `users`: positions may
refer to the shared demo user or to accounts that no longer exist, and a constraint
would orphan or block existing business data.

### Enumerations

- `UserStatus`: ACTIVE, DISABLED; persisted as String.
- `UserRole`: USER, ADMIN; persisted as String in `user_roles`.

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
| `users` | Normal user accounts and their authentication state |
| `user_roles` | Roles per account (element collection; cascades on user deletion) |
| `flyway_schema_history` | Flyway bookkeeping (applied migration versions/checksums) |

## Schema Management

Since 0.4.0 the schema is managed by **Flyway** (`quarkus-flyway`); Hibernate runs with
`quarkus.hibernate-orm.schema-management.strategy=none` and never alters the schema.

- Migrations are applied automatically at startup (`quarkus.flyway.migrate-at-start=true`).
- Migration scripts live in `backend/src/main/resources/db/migration/`:
  - `V1__baseline.sql` — snapshot of the 0.3.0 schema (extracted from the live DEV/PROD DBs).
  - `V2__add_index_positions_user_timestamp.sql` — composite index
    `idx_positions_user_timestamp (user_id, timestamp)` backing the history query
    `WHERE user_id = ? ORDER BY timestamp DESC` (see Data Access).
  - `V3__create_places_table.sql` — `places` POI cache table with the geohash and
    coordinate indexes (`idx_places_geohash`, `idx_places_coords`) backing the
    cache geoboxing lookup; `fetch_lat`/`fetch_lon` record the fetch origin for a
    future coverage-aware cache read.
  - `V4__add_place_details_to_positions.sql` — snapshots the contact metadata of an
    adopted place onto the position (`phone`, `website`, `opening_hours`,
    `wheelchair`), so History can render it without touching the `places` cache.
  - `V5__create_users_table.sql` — `users` (PK `user_id`, unique `user_id_lower`
    and `email`, hash/status/login state/timestamps/`entity_version`) and
    `user_roles` (element collection, `ON DELETE CASCADE`). Existing business data
    is untouched: no rows are migrated and `positions.user_id` stays a plain string.
  - `V6__add_auth_epoch_to_users.sql` — `auth_epoch BIGINT NOT NULL DEFAULT 0`, the
    per-account credential generation carried by the JWT's `ver` claim; incremented
    on password change/reset to invalidate earlier tokens. Existing accounts start
    at 0 and keep their current tokens.
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
sorted ascending and capped at `aroundme.max-places × number of category groups`
in memory (see `Places.findCached`).

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
| Open-Meteo | REST/JSON | Current `temperature_2m`, `weather_code`, `uv_index`, `is_day`, `elevation`; hourly forecast `temperature_2m`, `weather_code`, `uv_index`, `precipitation_probability`, `is_day` (`forecast_hours`, `timezone=auto`) per position preview |
| Nominatim (OSM) | REST/JSON | Reverse geocoding → address parts (house number, road, city, country); the POI `name`/`display_name` prefix is discarded |
| Geoapify | REST/JSON | POI places around a coordinate (category groups, radius, limit, `lang`); one request per `\|`-separated category group |
| OSM tile server | HTTPS | Map tiles (browser-direct, Leaflet) |
| Google Maps | HTTPS | Share link from map popups (native share) |

---

# Security Architecture

## Authentication

Stateless signed JWT bearer tokens (RS256, `quarkus-smallrye-jwt` +
`smallrye-jwt-build`). `POST /auth/register`, `/auth/login` and `/auth/claim` return
a token; protected requests send `Authorization: Bearer <token>`. Claims are only
`sub` (the permanent userId), `iat`, `exp`, `iss` (`locate.me`), `aud`
(`locate.me-pwa`), `groups` (USER/ADMIN) and `ver` (the account's credential
generation). Lifetime is `auth.jwt.lifespan` (default 30 days); issuer/audience are
verified (`mp.jwt.verify.issuer/audiences`). There are no sessions, cookies, refresh
tokens or logout, and no token-revocation list.

**Token invalidation without a session store.** `ver` mirrors `users.auth_epoch`.
A password change (`PUT /users/me/password`) or an administrative reset
(`PUT /users/{userId}/password`) increments the account's generation, so every token
issued before the change is rejected with 401 on its next request — including after a
deactivated account is reactivated. A normal login or registration issues a token with
the current generation. This is one integer on the account, checked against the token
that is already loaded per request, not a per-token list. A self-service password
change therefore signs out the device that performed it; the frontend must clear the
token and show the login screen again.

Signing/verification keys: local dev/test use the checked-in key pairs
(`backend/src/main/resources/jwt/dev-*.pem`, `backend/src/test/resources/jwt/test-*.pem`);
deployed DEV and PROD must provide `JWT_SIGN_KEY_LOCATION` (private PEM) and
`JWT_PUBLIC_KEY_LOCATION` (public PEM). `JwtTokens` signs a throw-away token at
startup, so a missing signing key fails the deployment immediately. How to generate,
verify, install and rotate the pair: see [JWT key provisioning](#jwt-key-provisioning).

Passwords: bcrypt (`quarkus-elytron-security-common`, cost 10), 8–32 characters and
at most 72 UTF-8 bytes — longer input is rejected instead of bcrypt-truncated. Login
failures are counted per account and escalate a temporary cooldown (1/5/15 minutes
after every five failures); a successful login resets the state. Unknown,
unmigrated, disabled, locked and wrong-password accounts all return the same
`401 {"error":"Invalid credentials"}`.

The shared demo user `user123` is the only unauthenticated identity: it is never
stored as an account, has no password/email/role/JWT, cannot register or claim, and
its requests are rate-limited per client address. It is defined solely by
`DemoUserPolicy`.

## Authorization

`CurrentUser` resolves a protected request from the verified token `sub`, loads the
account from H2 and requires `ACTIVE`. `@Authenticated`/`@RolesAllowed("ADMIN")`
guard `/users/**`; the position and place endpoints are `@PermitAll` for the
transition and resolve their identity as follows:

1. valid bearer token → its `sub` (a client-supplied `userId` is ignored);
2. exact `user123` → the shared demo identity;
3. `auth.legacy-userid-auth=true` **and** an existing `ACTIVE` account with
   `passwordHash == null` → that legacy id (former 400/401 contract preserved);
4. otherwise 401.

A migrated account therefore cannot fall back to the query parameter. The legacy
`allowed.user.ids` configuration no longer authorizes anything by itself: it is read
on **every startup** by `LegacyUsers`, which creates missing **unmigrated** accounts
idempotently, never overwrites or deletes them, and skips `user123`. Adding an ID
therefore creates the account at the next restart; removing one does **not** delete,
disable or revoke an existing account (deactivate it through the admin API instead).
`auth.admin.user.ids` grants ADMIN to existing accounts only.

## Account bootstrap and migration

- `GET /api/auth/migration-status/{userId}` tells the frontend whether a one-time
  migration is needed.
- `POST /api/auth/claim` is the migration: it loads the existing account, requires
  `passwordHash == null`, validates a new password and recovery email, stores the
  optional display name, sets the hash and email, preserves the identifier, roles and
  every business relationship, and returns a token. A second claim → 409.
- `auth.claim.enabled` (default `true`, env `AUTH_CLAIM_ENABLED`) is an operational
  gate: when `false`, claim returns `503 {"error":"Account migration is temporarily
  disabled"}` while login, registration and migration-status keep working. PROD keeps
  it disabled until the frontend migration UI is live.
- New registrations are stored directly in H2; an existing legacy id cannot be
  registered (409) and can only be upgraded through `claim`.
- Administrative recovery: `PUT /api/users/{userId}/password` (ADMIN) sets a new
  password when a user forgot it or lost access to the recovery email. It clears a
  temporary login lock and invalidates every earlier token of that account. The
  administrator can set the recovery email through the general `PUT /users/{userId}`.
- Self-service password recovery by email is not implemented yet; both
  `/auth/password-reset/*` endpoints return 501.

## Administrative flow

ADMIN accounts come from the ops-controlled bootstrap, not from public
registration: `auth.admin.user.ids` (env `AUTH_ADMIN_USER_IDS`) grants ADMIN to
**existing** accounts at startup. It never creates a user and never revokes a role.
An account listed there must therefore already exist — either already in H2 or listed
in `ALLOWED_USER_IDS` so the legacy bootstrap creates it — and the change takes effect
on the next restart. The grant is idempotent, case-insensitive, skips `user123` and
logs a warning for an unknown id.

### Obtaining an admin token

There are no sessions and no refresh tokens; every admin call uses a normal bearer
token from the claim/login flow.

```bash
BASE=http://localhost:8090/api        # deployed: https://<host>/api
J='Content-Type: application/json'

# First time: the bootstrapped account has no password yet.
ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/claim" -H "$J" \
  -d '{"userId":"adminUser","password":"admin-password-1","email":"admin@example.test"}' \
  | jq -r .token)

# Afterwards:
ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "$J" \
  -d '{"userId":"adminUser","password":"admin-password-1"}' | jq -r .token)
```

`GET /api/users/me` with that token shows `"roles": ["ADMIN","USER"]`; the token's
`groups` claim is what `@RolesAllowed("ADMIN")` checks on `/api/users/**`.

### Operations

Every call needs `-H "Authorization: Bearer $ADMIN_TOKEN"`.

| Operation | Call |
|---|---|
| List accounts | `GET /api/users` |
| Read one account | `GET /api/users/{userId}` |
| Create an account | `POST /api/users` with `userId`, `name`, `password`, `email` and optional `roles`/`status` → `201` |
| Update an account | `PUT /api/users/{userId}` — only `name`, `email`, `status`, `roles`; a body `userId` that differs from the path → `409`; passwords are never changed here |
| Deactivate | `DELETE /api/users/{userId}` → status `DISABLED` (`204`); the account and its business data stay |
| Reactivate | `PUT /api/users/{userId}` with `{"status":"ACTIVE"}` |
| Reset a password | `PUT /api/users/{userId}/password` with `{"password":"…"}` (optional `passwordConfirmation`) → `204` |

```bash
# Support case: forgotten password and lost recovery email
curl -i -X PUT "$BASE/users/hero123/password" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "$J" \
  -d '{"password":"new-password-42"}'

curl -i -X PUT "$BASE/users/hero123" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "$J" \
  -d '{"status":"ACTIVE","email":"hero@example.test"}'

curl -s "$BASE/users" -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

### Recovery runbooks

| Situation | Steps |
|---|---|
| User forgot the password | Admin reset → give the new password to the user out-of-band → the user changes it via `PUT /users/me/password` once the frontend offers it |
| User lost the recovery email | `PUT /users/{userId}` with the new `email`; reset the password if access is lost as well |
| Account or token suspected compromised | `DELETE /users/{userId}` (all tokens are blocked immediately because the account is no longer ACTIVE) → `PUT /users/{userId}/password` (bumps the credential generation) → `PUT /users/{userId}` with `{"status":"ACTIVE"}`. Tokens from before the reset stay invalid after reactivation |
| Read-only support | `GET /users`, `GET /users/{userId}` |

Resetting a still-unmigrated legacy account gives it a password (its legacy
`?userId=` fallback ends) but no recovery email; set the email with the general
update if needed. Self-service email recovery remains deferred (`/auth/password-reset/*`
→ 501); the admin reset is the supported path.

### Rules and side effects

- **The last active administrator cannot be deactivated or demoted** (`409`): grant
  ADMIN to another account first.
- Deactivation is preferred over deletion and there is no physical-delete endpoint, so
  `positions.user_id` references never dangle.
- A password change or reset bumps the account's `auth_epoch`; every token issued
  before it is rejected (401) on its next request, including after reactivation.
  Resetting the **admin's own** password therefore invalidates the token used for the
  reset — log in again with the new password.
- Every admin call re-validates the caller from H2 (exists, `ACTIVE`, matching
  `auth_epoch`) in addition to the token signature and the ADMIN role; a stale admin
  token gets 401 even though its `groups` claim is still valid.
- `user123` is not an account: it cannot be listed, reset or deactivated.
- The admin endpoints are not rate-limited (they require a valid admin token).
- Tokens live 30 days (`auth.jwt.lifespan`) and there is no logout endpoint; a client
  "logs out" by discarding its token. Token theft is bounded by deactivation and reset,
  not by expiry alone.
- Errors use `{"error":"…"}`: 400 invalid input, 401 missing/expired/stale token or a
  disabled caller, 403 role missing, 404 unknown target, 409 conflict or last admin.

### Claim gate and migration progress

A deployment that carries the backend before the frontend (PROD) sets
`AUTH_CLAIM_ENABLED=false`: the one-time claim — the only public path that turns a
guessable legacy id into an account — stays unavailable, while login, registration,
admin operations and `migration-status` keep working. Enable it (`true`) for the
frontend cutover. `GET /api/users` shows a non-sensitive `hasPassword` flag per
account: `false` means the account is still an unmigrated legacy account, `true`
means it has been claimed or registered. That is the list to watch during the
migration.

Swagger UI (`/q/swagger-ui`) can replace curl locally: log in through `/auth/login`,
click **Authorize**, paste the token, then call `/api/users/**`. It is reachable in
PROD too (`quarkus.swagger-ui.always-include=true`).

A copy-pasteable `mvn quarkus:dev` walkthrough of the whole flow — demo, legacy,
register/login, claim, self-service, admin reset, claim gate and rate limits — lives
in [api-auth-walkthrough.md](api-auth-walkthrough.md).

## Rate Limiting

Bucket4j (`io.quarkiverse.bucket4j:quarkus-bucket4j`, annotation `@RateLimited`,
config namespace `quarkus.rate-limiter.*`) throttles requests **per user** to protect
the backend from request flooding (e.g. a misbehaving client or a scripted attack).

- **Buckets** — `pwa-standard` (reads: `GET /positions`, `GET /positions/current`,
  `GET /places`) and `pwa-critical` (writes/deletes: `POST /positions`,
  `DELETE /positions/{id}`). Both are `shared=true` pools keyed by
  `UserIdIdentityResolver`: the verified token subject when authenticated, otherwise
  the `userId` query parameter; the demo user is keyed by client address, and
  missing/blank ids share the bounded `unknown` bucket. Limits: 10 reads / 30 s and
  5 writes+deletes / 30 s per user (token-bucket).
- **Authentication endpoints** — `security.AuthRateLimits` creates the buckets
  programmatically (the annotation resolver needs a `userId` query parameter that
  login/registration do not have), keyed by the client address and, where useful, the
  userId: login 5/min, registration 3/h, claim 5/h, migration-status 10/min, demo
  requests 20/min (`auth.rate-limit.*`). Exhaustion returns the same 429 response.
  The registry is bounded; buckets are in memory and reset on restart.
- **Enforcement** — the interceptor consumes a token before the endpoint method runs;
  on exhaustion a `RateLimitException` is thrown and mapped by `TooManyRequestsMapper`
  (a `@Provider` registered at `@Priority(Priorities.USER - 1)` so it wins over the
  extension's default mapper) to HTTP 429 with a `Retry-After` header, the JSON body
  `{"error":"TOO_MANY_REQUESTS","status":429}`, and an INFO log line
  (`Rate limit exceeded for user <id>: <METHOD> <path> – retry after <n>s`).
- **State** — in-memory token buckets per identity (single backend instance; reset on
  restart; bounded by `quarkus.rate-limiter.max-size`, default 1000).
- **External API protection** — a second, independent layer protects outgoing calls
  whose providers enforce quotas per API key or source IP. `security.ExternalApiRateLimits`
  owns three **global** Bucket4j buckets (not per user): Geoapify 2 calls/s (below its
  3 calls/s API-key limit), Nominatim 1 call/s and Open-Meteo 5 calls/s. A call waits up
  to `external-api.max-wait-seconds` (default 5 s) for a token; when the wait is
  exhausted the request returns the same 429 response. The limiter is invoked
  immediately before each outgoing call — before every Geoapify category-group request
  in `Places.fetchAndStore`, and before the Nominatim/Open-Meteo calls in
  `Positions.enrich` — outside the existing catch blocks so a rejection is not mistaken
  for a failed enrichment. The 429 body/`Retry-After` is shared with
  `TooManyRequestsMapper` via `security.TooManyRequests`. These buckets protect
  per-second request rates; daily/monthly provider quotas are not tracked.
- **Exempt** — `GET /api/system/info` is not annotated, so the frontend status probe is
  never throttled and the online/offline indicator stays reliable; the admin-only stats
  endpoints (`GET /api/positions/stats`, `GET /api/places/stats`) are exempt as they
  require the secret `adminKey`.
- **Tests** — the IT suite keeps `quarkus.rate-limiter.enabled=false` and very high
  `auth.rate-limit.*` values (`src/test/resources/application.properties`);
  `RateLimitIT` re-enables the `pwa-*` buckets and `AuthRateLimitIT` shrinks the
  authentication buckets, both via `@TestProfile`, asserting the 429 status, JSON body
  and `Retry-After`. The general IT suite uses very high `external-api.*` limits;
  `ExternalApiRateLimitIT` overrides them with one-token buckets and asserts the 429 for
  the Geoapify and Nominatim call paths, while `ExternalApiRateLimitsTest` covers all
  three global buckets directly.
- **Limitation / follow-up** — per-user quotas do not stop distributed floods or
  connection-level DoS; per-IP rate limiting at the Caddy edge is the intended next
  step (see Planned Technical Improvements).

## Session Management

Stateless REST; no sessions.

## Data Protection

Parameterized JPQL only; database never exposed to clients; no secrets in the
frontend; TLS terminated by Caddy2. Coordinates are personal data — scope is
self-hosted and private.

## Logging

The user and authentication endpoints emit one INFO line per request at the
boundary, with the actor/target only — never credentials:

- `POST /api/auth/register|login|claim userId=…`
- `GET /api/auth/migration-status userId=… migrationRequired=…`
- `POST /api/auth/password-reset/request|confirm … (not implemented)`
- `GET|PUT /api/users/me[/password|/recovery-email] userId=…`
- `POST|GET|PUT|DELETE /api/users[/{userId}[/password]] admin=… target=…`

The controls add the outcome at INFO: registered, migrated, logged in, failed login
attempt `n`, profile updated, password changed, recovery email changed, administrator
created/updated/deactivated/password reset, plus the startup bootstrap summary. At
DEBUG (the project package runs at DEBUG in DEV) the identity resolution adds
`Identity resolved as … via bearer token | legacy fallback | demo user`, which makes
the transition mode explicit.

Never logged: passwords, password hashes, reset tokens, JWTs, recovery email
addresses, `admin.key` or signing keys. Request-supplied identifiers pass through
`security.LogValues.safe` (CR/LF/TAB replaced, capped at 64 characters), so a crafted
userId cannot forge log lines or flood the log. Failed logins are rate-limited, which
also bounds their log volume.

---

# Build & Deployment

## Build Technology

Maven; Quarkus platform BOM 3.33.3.1; uber-jar artifact.

## Environment Overview

| Environment | Host | Port | Database |
|------------|------------|------------|------------|
| Local | dev machine | 8090 (`%dev`) | in-memory (`mvn quarkus:dev`) |
| DEV | 192.168.178.196 `/opt/locateme/dev/backend/` | 8090 | file `data/locator` |
| PROD | 192.168.178.196 `/opt/locateme/prod/backend/` | 8080 | file `data/locator` |

## Deployment Flow

- `deploy-backend-dev2.sh`: verifies a single JAR, cleans old JARs, `rsync`s it to DEV.
- `deploy-frontend-dev.sh`: `rsync -avz --delete` frontend → DEV.
- Server management: `start-locateme-backend.sh prod|dev` / `stop-locateme-backend.sh`
  set `ALLOWED_USER_IDS` + `QUARKUS_DATASOURCE_JDBC_URL` and restart the current JAR.
  For the authentication release they must additionally provide
  `JWT_SIGN_KEY_LOCATION` (private PEM) and `JWT_PUBLIC_KEY_LOCATION` (public PEM) in
  PROD; `ALLOWED_USER_IDS` keeps working but is now bootstrap input only. A user who
  disappears from it is neither deleted nor disabled.
- Local helpers: `start-locate-tunnel.sh`, `start-h2-tunnel.sh` (SSH tunnels; H2 Shell/console).

## JWT key provisioning

The backend signs and verifies RS256 bearer tokens with an RSA key pair. The
private key stays with the backend; the public key is only used for verification.

| Environment | Profile | Key source |
|---|---|---|
| Local development (`mvn quarkus:dev`) | `%dev` | checked in: `backend/src/main/resources/jwt/dev-private.pem` + `dev-public.pem` — no setup required |
| Tests (`mvn verify`, `@QuarkusTest`) | `%test` | checked in: `backend/src/test/resources/jwt/test-private.pem` + `test-public.pem` |
| Deployed DEV (`/opt/locateme/dev/backend/`, port 8090) | `prod` | own pair on the server + `JWT_SIGN_KEY_LOCATION` / `JWT_PUBLIC_KEY_LOCATION` |
| PROD (`/opt/locateme/prod/backend/`, port 8080) | `prod` | own pair on the server + `JWT_SIGN_KEY_LOCATION` / `JWT_PUBLIC_KEY_LOCATION` |

The packaged JAR runs under the `prod` profile; the `%dev` key block applies only to
`mvn quarkus:dev`. Both deployed environments therefore need their own pair, and the
checked-in development key must never be used there (a dev token would otherwise be
accepted by PROD, and vice versa).

**Generate a pair.** `openssl genpkey` writes a PKCS#8 private key
(`-----BEGIN PRIVATE KEY-----`) and `openssl pkey -pubout` the matching
SubjectPublicKeyInfo public key (`-----BEGIN PUBLIC KEY-----`); both are the formats
SmallRye JWT expects. 2048 bit is the minimum, 3072 is a good default. Do not use a
passphrase: the backend has no password setting for the key, so file permissions are
the protection.

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out jwt-private.pem
openssl pkey -in jwt-private.pem -pubout -out jwt-public.pem
```

**Verify the pair.** Both `sha256sum` lines must print the same hash:

```bash
openssl pkey -in jwt-private.pem -check -noout
openssl pkey -in jwt-private.pem -pubout -outform DER | sha256sum
openssl pkey -pubin -in jwt-public.pem -outform DER | sha256sum
```

**Install on the server.** Keep the files outside the repository and readable only
by the account that runs the JAR (the following is the PROD layout; use the mirrored
`/opt/locateme/dev/backend/jwt/` paths for DEV):

```bash
install -m 600 jwt-private.pem /opt/locateme/prod/backend/jwt/private.pem
install -m 644 jwt-public.pem  /opt/locateme/prod/backend/jwt/public.pem
```

**Export in `start-locateme-backend.sh`** (absolute paths — the JVM working directory
is not a reliable reference):

```bash
export JWT_SIGN_KEY_LOCATION=/opt/locateme/prod/backend/jwt/private.pem
export JWT_PUBLIC_KEY_LOCATION=/opt/locateme/prod/backend/jwt/public.pem
```

The startup log prints `JWT signing key is available`. A missing or unreadable key
fails startup (`JwtTokens` signs a throw-away token at boot) instead of silently
issuing tokens that nobody can verify.

**Rotation.** Generate a new pair, replace both files, restart the backend. There is
no revocation list and no multi-key support, so every previously issued token becomes
invalid and all users must log in again. The same applies when the checked-in dev key
is rotated.

**Non-prod profile note.** If a deployed instance is ever started with
`QUARKUS_PROFILE=dev`, the `%dev` block points at the classpath key and ignores
`JWT_SIGN_KEY_LOCATION`. Override it with `SMALLRYE_JWT_SIGN_KEY_LOCATION` and
`MP_JWT_VERIFY_PUBLICKEY_LOCATION` instead.

## Configuration (application.properties)

| Property | Description |
|------------|------------|
| `quarkus.package.jar.type=uber-jar` | Single executable JAR |
| `quarkus.datasource.*` (`%dev`, `%test`) | H2 URLs + credentials |
| `quarkus.hibernate-orm.schema-management.strategy` | `none` (schema owned by Flyway; non-deprecated replacement for `quarkus.hibernate-orm.database.generation`) |
| `quarkus.flyway.migrate-at-start` | `true` — apply pending migrations on startup |
| `quarkus.flyway.baseline-on-migrate`, `quarkus.flyway.baseline-version` | `true` / `1` — baseline existing non-empty DBs at v1, skipping `V1__baseline.sql` |
| `allowed.user.ids` (+ `%dev`, `%test`) | **Bootstrap only**: read on **every startup** by `LegacyUsers` to create missing unmigrated accounts (trim, ignore blanks, case-insensitive de-dupe, skip `user123`). Adding an ID imports it at the next restart; removing one never deletes, disables or revokes an existing account. Never authorizes a request |
| `auth.admin.user.ids` (+ `%dev`, `%test`) | Ops-controlled ADMIN bootstrap (`${AUTH_ADMIN_USER_IDS:}`): grants ADMIN to existing accounts, never creates or demotes |
| `auth.claim.enabled` (`${AUTH_CLAIM_ENABLED:true}`) | Operational gate for the one-time legacy claim. `false` → `POST /api/auth/claim` returns 503; login, registration and migration-status keep working. PROD keeps it `false` until the frontend migration UI is live |
| `auth.jwt.issuer`, `auth.jwt.audience`, `auth.jwt.lifespan` | Token issuance: `locate.me`, `locate.me-pwa`, 30 days |
| `mp.jwt.verify.issuer`, `mp.jwt.verify.audiences` | Token verification on every bearer request |
| `%dev/%test.smallrye.jwt.sign.key.location`, `%dev/%test.mp.jwt.verify.publickey.location` | Dev/test RS256 key pair (`jwt/dev-*.pem`, `jwt/test-*.pem`); PROD `smallrye.jwt.sign.key.location=${JWT_SIGN_KEY_LOCATION}`, `mp.jwt.verify.publickey.location=${JWT_PUBLIC_KEY_LOCATION}` |
| `auth.legacy-userid-auth` | `true` while the frontend still sends `?userId=`; allows only the demo user and **unmigrated** legacy accounts. Set to `false` after the frontend migration |
| `auth.password.min-length`, `auth.password.max-length`, `auth.password.bcrypt-cost` | Password policy (8 / 32 / 10); no silent bcrypt truncation (72 UTF-8 bytes max) |
| `auth.login.max-failed-attempts`, `auth.login.cooldowns` | 5 failures, then 1/5/15 minute temporary cooldowns; reset on success |
| `auth.rate-limit.login.*`, `auth.rate-limit.registration.*`, `auth.rate-limit.claim.*`, `auth.rate-limit.migration-status.*`, `auth.rate-limit.demo.*` | Per-client authentication buckets: login 5/min, registration 3/h, claim 5/h, migration-status 10/min, demo 20/min |
| `quarkus.http.proxy.proxy-address-forwarding` | `true` — trust the Caddy `X-Forwarded-For` so the per-client authentication limits see the real address |
| `admin.key` (+ `%dev`, `%test`) | Single admin key for the stats endpoints: `${ADMIN_KEY:change-me}` (env-var overridable in prod), dev `dev-admin-key`, test `test-admin-key` |
| `nominatim_uri/mp-rest/url`, `weather_uri/mp-rest/url` | REST client base URLs |
| `nominatim.format`, `nominatim.zoom`, `nominatim.layer` | Nominatim reverse params: format (`jsonv2`), address granularity (`18`), layer filter (`address`; accepted `address,poi,railway,natural,manmade`; overridable via env `NOMINATIM_LAYER`). The layer filter does not hide POI names — a shop with a house number is served from the address layer — so `Positions` composes the label from the address parts, ignores `name` and uses `display_name` only as a fallback when no address part exists |
| `weather.current-fields`, `weather.hourly-fields` | Comma-separated Open-Meteo fields for the current values and the hourly forecast (both include `is_day`) |
| `weather.forecast-hours` | Number of future hourly forecast slices returned (default 4; the current hour is skipped) |
| `weather.timezone` | Open-Meteo timestamp timezone (`auto` = the coordinates' local timezone, so times match the local wall clock) |
| `weather_uri/mp-rest/read-timeout`, `weather_uri/mp-rest/connect-timeout` | Open-Meteo client timeouts (ms), mirroring Geoapify |
| `geoapify_uri/mp-rest/url`, `geoapify.categories`, `geoapify.limit`, `geoapify.radius`, `geoapify.format`, `geoapify.api-key` | Geoapify Places client: base URL, category groups (`catering,commercial,healthcare,leisure,entertainment,sport.fitness\|accommodation.hotel,tourism.sights`; `\|` separates groups, each fetched with its own request), result limit per group, fetch radius (m, 700), format, API key (`${GEOAPIFY_API_KEY:}`) |
| `aroundme.cache-radius` | Cache bounding-box radius (m, 700) for the cache-first lookup |
| `aroundme.exclude-categories` | Comma-separated secondary POI categories to exclude (e.g. `playground`); applied on cache hits and fresh fetches |
| `aroundme.max-places` | Maximum number of places returned per category group (default 20); total response cap = value × number of groups. `geoapify.limit` still controls the Geoapify fetch / cache size per group |
| `aroundme.read-from-cache` | `false` (default) — every request fetches fresh from Geoapify, the H2 cache is still written but never read; `true` restores the cache-first geoboxing lookup (`Places.findNear`) |
| `quarkus.rate-limiter.buckets.pwa-standard.*` | Read bucket: `limits[0].permitted-uses=10`, `limits[0].period=30s`, `identity-resolver` (`security.UserIdIdentityResolver`), `shared=true` |
| `quarkus.rate-limiter.buckets.pwa-critical.*` | Write/delete bucket: `limits[0].permitted-uses=5`, `limits[0].period=30s`, `identity-resolver` (same), `shared=true` |
| `external-api.geoapify.requests`, `external-api.geoapify.period-seconds` | Global Geoapify bucket (default 2 calls/s; Geoapify allows 3/s per API key) |
| `external-api.nominatim.requests`, `external-api.nominatim.period-seconds` | Global Nominatim bucket (default 1 call/s) |
| `external-api.weather.requests`, `external-api.weather.period-seconds` | Global Open-Meteo bucket (default 5 calls/s) |
| `external-api.max-wait-seconds` | Maximum blocking wait for a global external-API token (default 5 s); when exhausted the request returns 429 |
| `%dev.quarkus.http.port=8090` | DEV port |
| `quarkus.log.*` | Console DEBUG for project package |

---

# Quality Assurance

## Testing Strategy

| Test Type | Scope |
|------------|------------|
| Architecture (ArchUnit) | `BceArchitectureTest` — enforces the BCE rules during unit tests (Surefire): component/layer package structure, boundary/control/entity membership, dependency direction (no control→boundary, no entity→boundary/control), `EntityManager` only in controls, `@Transactional` only in boundary, JAX-RS boundary methods return `Response`, no constructor injection, REST clients end with `Client`, no prohibited class suffixes. Documented exceptions: `DatabaseHealthCheck` (health check in boundary), `SystemInfo` (`@ApplicationScoped` control), `security` infra package, static-util/REST-client interfaces in control |
| Integration tests (IT) | REST + persistence + enrichment on in-memory H2 (`PositionsResourceIT`, incl. `createWithTagAndComment` and `createWithInvalidTag`; `PlacesResourceIT` — cache hit/miss, distance sorting, dedup, unnamed-place filtering, language). Authentication (`AuthRegistrationIT`, `AuthLoginIT`, `AuthClaimIT`, `JwtAuthorizationIT`, `UsersMeIT`, `UsersAdminIT`, `DemoUserIT`, `AuthRateLimitIT`, `PositionsJwtIT`) covers registration/duplicates, the generic 401 + cooldown, legacy claim and its effect on the old query-parameter path, token validation/disabled accounts, self-service fields/password/recovery email, admin CRUD + last-admin guard, the demo policy, the auth buckets and token-vs-query identity resolution; the pre-existing positions/places suites double as the regression proof that the legacy fallback still works |
| Unit tests | `DistanceCalculatorTest`, `GeoboxingTest`, `ClientLanguageTest`, `UserIdsTest`, `EmailsTest`, `PasswordsTest`, `LegacyUsersTest`, `UserTest`, `LogValuesTest` |
| System tests (`backend-st`) | Run against a live backend on 8090 (`PositionsSystemIT` + `PositionsResourceClient`) |
| Manual E2E | Real devices/browsers against DEV (Android Chrome/Brave, iOS Safari) |

## Test Frameworks

| Framework | Usage |
|------------|------------|
| JUnit 5 (Quarkus Test) | Integration tests |
| ArchUnit (`archunit-junit5`) | BCE architecture unit test (`BceArchitectureTest`) |
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

- Quarkus 3.33.3.1, Java 25, H2 2.4.240.
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
| TI-002 | Add per-IP rate limiting at the Caddy edge (`mholt/caddy-ratelimit` plugin, custom `xcaddy` build) as the first line of defense against floods/DoS; the in-app per-user quotas (`quarkus.rate-limiter.*`) remain the per-user fair-use layer | Planned |

---

# Change Log

The change log has moved to [docs/changelog.md](changelog.md) → [Technical Change Log](changelog.md#technical-change-log).
