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
| Reverse Proxy | Caddy2 on Debian Linux |
| Clients | Android Chrome PWA, Android Brave, iOS Safari PWA |
| Mapping | Leaflet.js + OpenStreetMap/Nominatim |
| Weather | Open-Meteo API |

## Documentation 
Functional Scope see ./docs/functional-scope.md 
Technical Landscape see ./docs/technical-landscape.md 

## Missing Context
If required information is missing:
- Ask for clarification instead of guessing.
- Do not invent credentials, endpoints, or configurations.

