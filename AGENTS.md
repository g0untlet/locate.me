# locate.me – AGENTS.md

## Project
Personal geo-tracking PWA. Small, trusted user base, not publicly exposed.
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


## Core Rules
### Quarkus Backend
- Use BCE architecture 
- Preserve package structure 
- Use Java 21 
- Use Quarkus 3.33.2
- Do not refactor unrelated code 
### HTML/JS Frontend
- No bundler, no framework – native ES6 modules only
- Never hardcode colors – always use CSS custom properties
- no sw.js, no caching

## Directory Structure
```
locate.me/
├── backend/        ← Quarkus backend with strict BCE architecture
├── backend-st/     ← System tests for backend
└── frontend/       ← Vanilla HTML/JS/CSS for PWA frontend
    ├── app.js
    ├── index.html
    ├── css/style.css
    └── js/
        ├── config.js
        ├── utils.js
        ├── api.js
        ├── state.js
        ├── ui/     (toast, badge, status, map)
        └── pages/  (settings, locate, history)
```

## Data Access
- NEVER build SQL queries using string concatenation with user input.
- Always use parameterized queries.
- Avoid exposing database structure in error messages.

## Missing Context
If required information is missing:
- Ask for clarification instead of guessing.
- Do not invent credentials, endpoints, or configurations.

