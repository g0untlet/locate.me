# Technical Landscape

## System Overview

### Purpose

Technical architecture of locate.me, a self-hosted geo-tracking PWA: a vanilla-JS
frontend records the current position together with weather, UV index, elevation and
address data enriched by a Quarkus backend. The functional scope is documented in
`docs/functional-scope.md`; this document covers the technical architecture only.

### Technology Stack

| Layer | Technology |
|---------|---------|
| Frontend | HTML5, Vanilla JavaScript (ES6 modules, no bundler), CSS3 (custom properties) |
| Frontend | Progressive Web App (PWA, installable) |
| Mapping | Leaflet 1.9.4 + OpenStreetMap tile server |
| Backend | Quarkus 3.33.2, Java 21 |
| API | REST (Jakarta REST), JSON-B / JSON-P |
| ORM | Hibernate ORM (schema generation = `update`) |
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
       Browser --HTTPS--> OSM tile server (Leaflet map tiles)
```

- All REST endpoints live under `/api` (`@ApplicationPath("/api")`).
- The frontend reaches `/api` directly through the Caddy2 proxy; map tiles and the
  two enrichment APIs (Open-Meteo, Nominatim) are the only external calls.

---

# Frontend Architecture

## Application Type

- Single Page Application (SPA)
- PWA: installable via `manifest.json` with icons; **no service worker** (explicitly
  deregistered at startup, no caching layer)

## Main Modules

| Module | Purpose |
|----------|----------|
| `app.js` | Entry point: bootstrap, tab navigation, backend status polling |
| `js/config.js` | API base URL resolution (dev port vs. relative proxy paths) |
| `js/api.js` | Fetch wrappers for all REST endpoints |
| `js/state.js` | Central mutable state (maps, cached fix, history data) |
| `js/utils.js` | Formatting helpers (dates, address, weather text/icons, UV level, elevation) |
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
└── system/                     system info feature (BCE)
    ├── boundary/   SystemBoundary
    └── control/    SystemInfo
```

## Main Modules

| Module | Purpose |
|---------|---------|
| `locator` | Position lifecycle (create/read/delete), geocoding + weather enrichment, distance/walking-time |
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

## Control Components

| Control | Responsibility |
|----------|----------|
| `Positions` | Orchestrates create (enrich → persist), delete and queries; sole `EntityManager` access |
| `DistanceCalculator` | Haversine distance + walking-time estimation (static util) |
| `SystemInfo` | Application metadata (artifactId, version, startupTime) |
| `GeocodingClient` | MicroProfile REST client → Nominatim reverse geocoding |
| `WeatherClient` | MicroProfile REST client → Open-Meteo forecast |

## Boundary Components

| Boundary | Responsibility |
|----------|----------|
| `PositionsResource` | REST `/positions`: create, delete, list, current; validation + userId authorization |
| `SystemBoundary` | REST `/system` → `/info` |
| `DatabaseHealthCheck` | SmallRye readiness check (`SELECT 1`) |

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
| GET | `/api/positions?userId=&lat=&lon=` | 200 list, newest first; optional `lat`/`lon` add response-only `distance` (km) and `walkingTimeMinutes` |
| POST | `/api/positions?userId=` | 201 + `Location`; persisted, enriched position |
| GET | `/api/positions/current?userId=&lat=&lon=` | 200 preview, `persist=false` (no row written) |
| DELETE | `/api/positions/{id}?userId=` | 204 |

Common errors: 400 invalid/missing `userId` or body; 401 userId not in allow-list.

## SystemBoundary (`/system`)

| GET | `/api/system/info` | 200 `{artifactId, version, startupTime}` |

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
| `tag` PositionTag | `tag` | VARCHAR | `@Enumerated(EnumType.STRING)` |
| `comment` String | `comment` | VARCHAR(255) | |

### Enumerations

- `WeatherCode`: numeric WMO codes; persisted as `Integer`.
- `PositionTag`: PARKING, SHOPPING, RESTAURANT, WORK, EDU, POI, LEISURE; persisted as String.

---

# Persistence

## Database

H2. Produktion: file-based `jdbc:h2:file:./data/locator;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE`;
DEV/tests: in-memory (`jdbc:h2:mem:locator_dev`, `jdbc:h2:mem:locator_test`). Credentials `sa`/`sa`.

## Tables

| Table | Purpose |
|---------|---------|
| `positions` | All saved positions |

## Schema Management

- Hibernate `database.generation=update`; no migration framework.
- **H2 2.4.240 regression (issue #4308):** native enum `CHECK(... IN(...))` constraints
  are compiled against one H2 session and crash inserts from newer sessions
  (SQLState 23514, "The database has been closed"). Constraint is therefore removed
  from all live databases, and schema changes must never re-create native enum CHECKs
  (rollout procedure: `docs/production-upgrade-0.3.0.md`).

## Data Access

No repository layer — control components use the Hibernate `EntityManager` directly
with parameterized JPQL (`findByUserId`, `findAll`, `find`/`remove`); SQL is never
built by string concatenation.

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
| OSM tile server | HTTPS | Map tiles (browser-direct, Leaflet) |
| Google Maps | HTTPS | Share link from map popups (native share) |

---

# Security Architecture

## Authentication

None — private application for a trusted, small user base; not publicly exposed (Caddy2).

## Authorization

`userId` query parameter is validated in `PositionsResource.validateAndAuthorize`
against `allowed.user.ids` (per profile, overridable via env `ALLOWED_USER_IDS`):
400 on missing/non-alphanumeric/>16 chars, 401 on unknown user.

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
| `quarkus.hibernate-orm.database.generation` | `update` |
| `allowed.user.ids` (+ `%dev`, `%test`) | Authorized users per profile |
| `nominatim_uri/mp-rest/url`, `weather_uri/mp-rest/url` | REST client base URLs |
| `%dev.quarkus.http.port=8090` | DEV port |
| `quarkus.log.*` | Console DEBUG for project package |

---

# Quality Assurance

## Testing Strategy

| Test Type | Scope |
|------------|------------|
| Integration tests (IT) | REST + persistence + enrichment on in-memory H2 (`PositionsResourceIT`, incl. `createWithTag`) |
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
- Frontend stays SPA/PWA; native ES6 modules, no bundler; no service worker/caching.

## Technology

- Quarkus 3.33.2, Java 21, H2 2.4.240.
- Caddy2 reverse proxy with HTTPS.
- HTTP/JSON communication; REST clients for Open-Meteo and Nominatim.
- Parameterized queries only — never SQL built from user input.
- H2 native enum CHECK constraints must not be (re-)created in the schema (2.4.240 regression; see Persistence).

---

# Technical Debt

| ID | Description | Priority |
|------|------|------|
| TD-001 | Schema managed by Hibernate `update`; fixes require manual per-DB constraint handling; no migration framework | Medium |

---

# Planned Technical Improvements

| ID | Description | Status |
|------|------|------|
| TI-001 | Adopt Flyway for versioned, explicit schema migrations (Hibernate `update` → `validate`) | Planned |

---

# Change Log

| Version | Date | Description |
|---------|---------|---------|
| 0.3.0 | 2026-08-10 | Initial version (replaces the template placeholder) |