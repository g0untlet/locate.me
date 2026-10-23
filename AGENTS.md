# locate.me – AGENTS.md

## Project
Personal geo-tracking PWA. Small, trusted user base, publicly exposed to small user base.
GitHub: https://github.com/g0untlet/locate.me

## Stack
| Layer | Technology |
|-------|------------|
| Backend | Quarkus 3, Java 25, Hibernate ORM, H2 file-based |
| Architecture | BCE (Boundry, Control, Entity) (~20 classes), separate skill available |
| Frontend | Vanilla JS, ES6 modules, HTML/CSS, no bundler, separate skill available |
| Website | Static trilingual (EN/DE/ES) marketing/install site, Vanilla HTML/CSS/JS, separate skill available |
| Reverse Proxy | Caddy2 on Debian Linux — terminates HTTPS and manages the TLS certificates |
| Protection | fail2ban watches the Caddy logs and jails unwanted IP addresses to prevent DoS attacks |
| Clients | Android Chrome PWA, Android Brave, iOS Safari PWA |
| Mapping | Leaflet.js + OpenStreetMap/Nominatim |
| Weather | Open-Meteo API |
| Places | Geoapify Places API (places around a geo position) |

## Documentation
- [Functional Scope](./docs/functional-scope.md)
- [Technical Landscape](./docs/technical-landscape.md)
- [Change Log](./docs/changelog.md)

Read only the section(s) relevant to the change (grep by heading). Read a whole document only when the task genuinely spans the architecture.

## Repo Map
- `backend/` Quarkus service, BCE components `aroundme/`, `locator/`, `security/`, `system/` (each boundary/control/entity).
- `backend/src/main/resources/db/migration/` Flyway. Never edit an applied migration (checksum) — add a new `V<n>__*.sql`.
- `backend-st/` out-of-process system tests (REST client → :8090).
- `frontend/` PWA, no bundler: `index.html` (APP_VERSION/APP_BUILD), `sw.js` (precache), `js/`, `locales/`, `css/style.css`.
- `website/` static EN/DE/ES pages.
- Project skills in `.agents/skills/`: `bce-architecture`, `bce-reviewer`, `pwa-frontend`, `website-maintenance`, `documentation-maintenance`, `quarkus-coding-security` — load the matching one before editing that area.

## Build & Test
- Backend: `cd backend && mvn -B clean verify` (~4 min; 58 unit + 61 integration tests).
- Dev mode: `cd backend && GEOAPIFY_API_KEY=<key> mvn quarkus:dev` → http://localhost:8090
- System tests: `cd backend-st && mvn -B clean verify` — requires the backend on :8090.
- Java 25 + Maven 3.9+; there is no CI, tests run locally.

## Versioning
- Backend version lives only in `backend/pom.xml`; also update the expected version in `backend/src/test/.../system/boundary/SystemBoundaryIT.java` (`/api/system/info`).
- Frontend `APP_VERSION`/`APP_BUILD` live in `frontend/index.html`; bump the `?v=` cache-buster of each changed frontend file there and in the matching `sw.js` `ASSETS` entry.
- Add one row at the top of the relevant `docs/changelog.md` section (Technical or Functional) with the `Component` (Frontend / Backend / Frontend + Backend / Infra / Docs) and that component's version.

## What's New
- Update `frontend/js/release-notes.js` with every release.
- Keep it compact: short tagline + 3–4 one-sentence bullets in EN/DE/ES/FR (EN fallback), language news last.
- Before PROD, remove the `_rcX` suffix from `APP_VERSION` and bump the frontend cache-busters.

## Missing Context
If required information is missing:
- Ask for clarification instead of guessing.
- Do not invent credentials, endpoints, or configurations.

