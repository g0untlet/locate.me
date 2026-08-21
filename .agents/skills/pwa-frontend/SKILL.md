---
name: pwa-frontend
description: 
  Skill for developing the locate.me Vanilla JS PWA frontend (progessive web app).
  Use this skill for ANY change to HTML, CSS or JavaScript in the locate.me
  project – new features, bugfixes, or refactoring. Contains module structure,
  design system, patterns and constraints of the project.
metadata:
  authors:
    - g0untlet
  version: "0.0.1"
  tags:
    - SPA
    - PWA
    - JavaScript
    - HTML
    - CSS
---

# locate.me Frontend Skill

## Stack & Constraints
- **No bundler** – native ES6 modules, all imports must include `.js` extension
- **No framework** – Vanilla JS, HTML, CSS only
- **No TypeScript**
- Cache-busting via query parameter in `index.html`: `style.css?v=X` and `app.js?v=X`
- Service Worker: `sw.js` with Workbox 7.3.0 (Google CDN, no build step), **Network-First**
  caching for `index.html` and same-origin JS/CSS. Fresh content online, cache only as
  offline fallback. Third-party (Leaflet CDN, map tiles) is NOT cached.
- Deployment: Debian Linux + Caddy2 reverse proxy, HTTPS

---

## Module Structure

```
frontend/
├── app.js                  ← Entry point, bootstrap, navigation, SW registration
├── index.html              ← SPA shell, FOUC script in <head>, cache-busters
├── sw.js                   ← Service worker: Workbox Network-First (app shell, JS/CSS)
├── css/style.css
└── js/
    ├── config.js           – API_BASE_URL, API_PATH
    ├── utils.js            – formatRelativeDate, formatShortAddress,
    │                          formatWalkingTime, getWeatherText,
    │                          getWeatherIconSvg, getLocationIconSvg
    ├── api.js              – apiGetSystemInfo, apiGetPositions,
    │                          apiGetCurrentPosition, apiPostPosition,
    │                          apiDeletePosition
    ├── state.js            – historyMap, historyMapData, currentHistoryView,
    │                          cachedLocatePosition, locateMap, locateMarker
    ├── ui/
    │   ├── toast.js        – showStatusToast
    │   ├── badge.js        – updateHistoryBadge, silentBadgeSync
    │   ├── status.js       – checkBackendStatus, renderBackendInfo, showError
    │   └── map.js          – setHistoryView, renderMapMarkers,
    │                          showLocateMap, initMapListeners
    └── pages/
        ├── settings.js     – Dark mode toggle, userId, attribution block
        ├── locate.js       – GPS fetch, save position
        └── history.js      – PTR, skeleton loader, filter/search,
                               fetchAndRenderHistory, showHistorySkeleton
```

---

## Currently Used Backend API
```
POST   /api/positions              – save position: persist the already-fetched enriched payload verbatim (backend does NOT re-enrich)
GET    /api/positions              – history (optional: ?lat=&lon= for distance)
GET    /api/positions/current      – preview: geocoding + weather enrichment (Open-Meteo/Nominatim), not persisted
DELETE /api/positions/{id}         – delete position
GET    /api/system/info            – { artifactId, version, startupTime }
```
Auth: `userId` in request body/query, backend validates against allowlist.

Save flow: the Locate page caches the enriched `/positions/current` preview (incl. GPS accuracy) and POSTs it back; it does NOT re-run GPS or re-fetch on save.

---

## Design System (CSS Custom Properties)

```css
/* Light (default) */
--bg-color, --bg-outer, --card-bg, --surface-subtle
--primary-color, --primary-hover, --primary-dark, --primary-tint
--text-color, --text-strong, --text-muted
--border-color, --border-radius: 24px
--shadow, --transition

/* Dark mode via [data-theme="dark"] on <html> */
```
**Rule:** Never hardcode colors – always use CSS custom properties.
**Dark mode:** Theme is set via `localStorage.getItem('theme')` in a FOUC-prevention
script in `<head>` before the CSS link tag.

---

## Key Patterns

### Service Worker (Workbox Network-First)
- `sw.js` loads Workbox 7.3.0 from `https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js`
  via `importScripts` (no bundler/build step). Guard `if (!self.workbox) return;` so a
  CDN outage degrades gracefully (no caching) instead of failing.
- Network-First is intentional: `index.html`, JS modules and CSS must never be served
  stale. When online the network response is returned and cached; offline the Cache
  Storage entry is the fallback.
- **Precache manifest in `sw.js`:** an `install` handler pre-populates the caches
  (`SHELL`/`ASSETS` arrays) so offline works after a single online visit. **RULE:** keep
  this list in sync with `index.html` (`?v=` cache-busters) and any new/removed file in
  the `js/` tree — otherwise offline falls back to a missing file. Only cache what the
  serving routes actually cover (navigations + same-origin script/style): do NOT add
  `manifest.json`, `favicon` or icons (they are not intercepted by the SW). Precache is
  only a fallback; the Network-First routes are the sole serving strategy (no staleness).
- Caches are namespaced `locateme-*` (`locateme-shell` for navigations,
  `locateme-assets` for same-origin script/style); `activate` purges any other cache.
- `workbox.core.skipWaiting()` + `clientsClaim()` let a deployed SW take control on the
  next load without a second visit.
- Caddy's `Cache-Control: no-store` header is unrelated to the SW: the Cache Storage
  API is independent of HTTP cache headers, so Network-First works alongside `no-store`.
- Registered from `app.js` (`registerServiceWorker()` at module top-level). API calls and
  third-party resources (Leaflet, map tiles) are intentionally not routed through the SW.
- Testing offline in DevTools: make sure **"Bypass for network"** is NOT ticked in
  Application → Service Workers — otherwise the SW is skipped for all requests and an
  offline reload fails with `ERR_INTERNET_DISCONNECTED` despite a populated cache.

### Avoiding Circular Dependencies
Pages receive dependencies as callbacks (deps pattern):
```js
fetchAndRenderHistory({ getActiveUserId, checkBackendStatus })
initSettingsPage({ onSave, getActiveUserId })
```

### Leaflet (History Map + Locate Map)
- CDN via cdnjs without SRI hashes (removed – were incorrect)
- Dark mode: override `.leaflet-popup-content-wrapper` and `.leaflet-popup-tip`
  via `[data-theme="dark"]` selector
- Use event delegation for buttons inside popups (popup DOM only exists after open)
- Call `invalidateSize()` after map toggle

### Chrome Android CSS Variables Bug
Dynamically injected `innerHTML` content does not reliably resolve CSS custom
properties in Chrome Android.
**Fix:** Explicit container rule:
```css
#container,
#container * { color: var(--text-muted); font-size: 0.75rem; }
```

### Pull-to-Refresh (history.js)
- Touch events on `#page-history`
- Guard: only trigger when `list.scrollTop === 0`
- `overscroll-behavior-y: contain` on `.app-container` prevents browser
  pull-to-refresh on all pages

### Skeleton Loader
- `showHistorySkeleton()` is called from `app.js` before `fetchAndRenderHistory()`
- Shimmer animation via CSS `@keyframes shimmer`

### History Filter
- `posMatchesFilter(pos, term)` – central function, ready for extension:
```js
(pos.displayName || '').toLowerCase().includes(t) ||
(pos.comment     || '').toLowerCase().includes(t) ||  // prepared
(pos.tags        || []).some(tag => tag.toLowerCase().includes(t)) // prepared
```
