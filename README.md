# Locate.me

A personal geo-location tracking application: a mobile-first **Progressive Web App (PWA)** frontend built with vanilla HTML/CSS/JS that requests high-accuracy GPS coordinates from the device and a **Quarkus 3 / Java 21** backend that enriches and persists them. The backend follows the **Boundary-Control-Entity (BCE)** architectural pattern and uses a file-based **H2** database.

## Features

- High-accuracy GPS fix with fast-lock tuning (accepts ~30m fixes in ≤8s, warm reuse of recent fixes)
- Automatic address reverse geocoding (OpenStreetMap / Nominatim)
- Weather, UV index, and elevation enrichment (Open-Meteo)
- Location history with distance and estimated walking, biking and driving times
- Optional tags and comments on saved locations (shown in history and after saving)
- Installable PWA (no service worker, no client-side caching)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JS (ES6 modules), HTML/CSS, no bundler |
| Backend | Quarkus 3.33, Java 21, BCE architecture |
| Database | H2 (file-based) |
| Reverse Proxy | Caddy2 |
| Mapping | Leaflet.js + OpenStreetMap |
| Weather | Open-Meteo API |

## Project Structure

```
locate.me/
 ├── frontend/    # PWA frontend (vanilla JS, no build step)
 ├── backend/     # Quarkus microservice (BCE: boundary/control/entity)
 ├── backend-st/  # Out-of-process system tests (MicroProfile REST clients)
 ├── docs/        # Functional scope, technical landscape, upgrade notes
 ├── deploy-frontend-dev.sh
 ├── deploy-backend-dev.sh
 └── start-*-tunnel.sh   # SSH tunnels for remote development
```

## Getting Started

### Prerequisites

- Java 21
- Maven 3.9+

### Backend (Dev Mode)

```bash
cd backend
mvn quarkus:dev
```

- Application: <http://localhost:8090>
- Swagger UI: <http://localhost:8090/q/swagger-ui>

### Frontend

The frontend is a static ES6 application with no build step. Serve `frontend/` with any static server — Caddy2 in production. Note that HTTPS is required for PWA installation.

## Testing

```bash
# Backend unit + integration tests
cd backend
mvn clean test failsafe:integration-test

# System tests (backend must be running on :8090)
cd backend-st
mvn clean verify
```

## Deployment

- `deploy-frontend-dev.sh` / `deploy-backend-dev.sh` deploy to the DEV server via rsync/SSH.
- Caddy2 terminates TLS and reverse-proxies `/api` to the backend for the DEV and PROD environments.
- Nothing is cached on clients: Caddy sends `Cache-Control: no-store` on all responses.

### Quick API check

```bash
curl -X GET "http://localhost:8090/api/positions?userId=user123"
```

## Documentation

- [./docs/functional-scope.md](./docs/functional-scope.md) — features, UI views, backend services, business objects
- [./docs/technical-landscape.md](./docs/technical-landscape.md) — architecture, REST API, data model, security, build & deployment
- [./docs/production-upgrade-0.3.0.md](./docs/production-upgrade-0.3.0.md) — H2 CHECK-constraint fix for upgrading 0.2.0 → 0.3.0
