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
- No Service Worker (deactivated due to cache invalidation issues)
- Deployment: Debian Linux + Caddy2 reverse proxy, HTTPS

---

## Module Structure

```
frontend/
├── app.js                  ← Entry point, bootstrap, navigation, SW deregistration
├── index.html              ← SPA shell, FOUC script in <head>, cache-busters
├── sw.js                   ← Passthrough, actively deregistered (not used)
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
POST   /api/positions              – save position
GET    /api/positions              – history (optional: ?lat=&lon= for distance)
GET    /api/positions/current      – status + weather (Open-Meteo)
DELETE /api/positions/{id}         – delete position
GET    /api/system/info            – { artifactId, version, startupTime }
```
Auth: `userId` in request body/query, backend validates against allowlist.

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
