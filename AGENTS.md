# locate.me – AGENTS.md

## Project
Personal geo-tracking PWA. Small, trusted user base, publicly exposed to small user base.
GitHub: https://github.com/g0untlet/locate.me

## Stack
| Layer | Technology |
|-------|------------|
| Backend | Quarkus 3, Java 21, Hibernate ORM, H2 file-based |
| Architecture | BCE (Boundry, Control, Entity) (~20 classes), separate skill available |
| Frontend | Vanilla JS, ES6 modules, HTML/CSS, no bundler, separate skill available |
| Website | Static bilingual (EN/DE) marketing/install site, Vanilla HTML/CSS/JS, separate skill available |
| Reverse Proxy | Caddy2 on Debian Linux |
| Clients | Android Chrome PWA, Android Brave, iOS Safari PWA |
| Mapping | Leaflet.js + OpenStreetMap/Nominatim |
| Weather | Open-Meteo API |

## Documentation 
Functional Scope see ./docs/functional-scope.md 
Technical Landscape see ./docs/technical-landscape.md 

## What's New
- Update `frontend/js/release-notes.js` with every release.
- Keep it compact: short tagline + 3–4 one-sentence bullets in EN/DE/ES/FR (EN fallback), language news last.
- Before PROD, remove the `_rcX` suffix from `APP_VERSION` and bump the frontend cache-busters.

## Missing Context
If required information is missing:
- Ask for clarification instead of guessing.
- Do not invent credentials, endpoints, or configurations.

