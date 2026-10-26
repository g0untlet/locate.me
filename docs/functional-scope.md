# Functional Scope: locate.me

## 1. Functional Areas

### 1.1. User Management
- The application supports multiple users, identified by a `userId`.
- The `userId` is stored in the browser's local storage.
- A default `userId` of "user123" is used if none is set.
- The backend validates the `userId` against a list of allowed users.

### 1.2. Geolocation
- The application can fetch the user's current geographical coordinates (latitude and longitude).
- The coordinates are used to display the user's location on a map.
- The coordinates are also used to fetch weather and address information.

### 1.3. Location History
- Users can save their current location.
- Saved locations are stored in a history.
- The history can be viewed as a list or on a map.
- Users can delete locations from their history.
- The list can be filtered by a single predefined tag (single-select chips) and/or a free-text search over the address and the comment; the two combine with AND and apply to the list and the map alike. A chip in the collapsed filter header shows the active filter(s) and clears tag and text in one tap, and only appears while a filter is set.
- For each saved location, the straight-line distance and the estimated travel times for walking, biking and driving are displayed.

### 1.4. Weather Information
- For a given location, the application fetches and displays the current temperature and weather conditions.
- The current UV-Index is also fetched and displayed.
- The Locate view can additionally show a short hourly forecast for the next few hours (configurable via `weather.forecast-hours`, default 4). Each slice shows the local time, a condition icon (day/night-aware), the temperature (°C, rounded), the UV index (rounded) and the precipitation probability.
- The forecast is fetched together with the current weather from Open-Meteo and is display-only — it is never saved.
- This is done by an external API (Open-Meteo).

The condition shown (current and for each forecast hour) is mapped from the WMO weather code — and the day/night flag returned by Open-Meteo — to an icon as follows:

| WMO code(s) | Condition | Day icon | Night icon |
|-------------|-----------|----------|------------|
| 0 | Clear sky | sun | moon |
| 1 | Mainly clear | sun + cloud | cloud + moon |
| 2 | Partly cloudy | sun + cloud | cloud + moon |
| 3 | Overcast | cloud | cloud |
| 45, 48 | Fog | fog lines | fog lines |
| 51–55 | Drizzle | rain cloud | rain cloud |
| 56, 57 | Freezing drizzle | rain cloud | rain cloud |
| 61–65 | Rain | rain cloud | rain cloud |
| 66, 67 | Freezing rain | rain cloud | rain cloud |
| 71–75 | Snow fall | snowflake | snowflake |
| 77 | Snow grains | snowflake | snowflake |
| 80–82 | Rain showers | rain cloud | rain cloud |
| 85, 86 | Snow showers | snowflake | snowflake |
| 95 | Thunderstorm | thunder cloud | thunder cloud |
| 96, 99 | Thunderstorm with hail | thunder cloud | thunder cloud |

### 1.5. Elevation Information
- For a given location, the application fetches and displays the elevation (meters above sea level).
- The elevation is retrieved from the Open-Meteo API together with the weather data.
- In the Locate view it is shown as a separate value below the address. In the History view it is shown as a muted pill (a small solid triangle + the value, e.g. `▲ 521 m`) in the expanded details row, in front of the coordinates pill — not inline with the address and no longer in the tile header.

### 1.6. Geocoding
- For a given location, the application fetches and displays the corresponding address.
- This is done by an external API (OpenStreetMap/Nominatim).
- Only the core address is shown: road + house number, city and country. POI names (shop, restaurant, sight, …) are never displayed, even when Nominatim answers with the POI of the building the coordinates fall on (`addresstype=shop`, e.g. a butcher at Viktualienmarkt 2) — POIs are covered by the Places Around Me feature instead.
- The city falls back to `town`, `village` or `municipality` when Nominatim returns no `city` (rural addresses). If the response carries no road or city at all (park, motorway, …), the raw Nominatim display name is shown as a fallback.

### 1.7. Places Around Me (POI Discovery)
- For a given location, the backend can fetch points of interest (POIs) around it from the Geoapify Places API. The default category groups are `catering,commercial,healthcare,leisure,entertainment,sport.fitness` and `accommodation.hotel,tourism.sights`.
- `geoapify.categories` may contain `|`-separated category groups. Each group triggers its own Geoapify request (using `geoapify.limit`); the results are combined, deduplicated by place ID and served nearest-first, so groups such as shops/restaurants no longer compete with tourism for the same result budget.
- Only categories listed in `geoapify.categories` are used for a place's primary/secondary category; any other category in the Geoapify response (e.g. `access` / `access.yes`) is ignored. Wheelchair information is still read from the raw category list.
- Secondary categories listed in `aroundme.exclude-categories` (currently `playground`) are excluded: such places are neither returned nor cached.
- Fetched places are cached in the database (deduplicated by the Geoapify place ID) and served nearest-first; a cache hit avoids a repeated external request. If one category group fails, the successful groups are still returned and cached; if every group fails, the request fails with `503`.
- The client renders every place returned by the backend (it no longer truncates the list to 20 rows). The places list scrolls internally when the grouped result set is larger. Tourism sights (`tourism.sights`, including subcategories such as `tourism.sights.museum`) and the legacy `tourism.attraction` use a dedicated camera icon; other tourism subcategories keep the generic tourism icon.
- The client groups the loaded places by their primary category into a single-select, icon-only filter row above the list: one chip per category present (canonical order `catering`, `commercial`, `healthcare`, `leisure`, `entertainment`, `sport`, `accommodation`, `tourism`, `service`, unknown categories last), each chip showing the icon of that category. Selecting a chip hides all other categories without any backend request; the active chip grows into a pill that also shows the localized category name, and tapping it again or the pinned × at the row end clears the filter. The row only appears when the result contains at least two categories. The counter switches to `shown of total` while a filter is active. Every new fetch (Refresh, GPS re-fetch, last-known-fix fallback) starts unfiltered; if the filter hides the currently selected place, the chooser falls back to the resolved address. Idle chips stay language-neutral (icon only); the name is used for the active chip, the tooltip and the accessible name.
- Each place row can be expanded in place: tapping a row selects it and unfolds its details (chevron indicator) — phone (`tel:`), website, opening hours and wheelchair access, rendered by the same builder as the saver's PLACE DETAILS card. Tapping the same row again closes the panel but keeps the selection; only one panel is open at a time and only rows that carry at least one detail are expandable (rows without details still select as before). The panel is dropped when the filter changes, the resolved address is selected or a new fetch starts. It lives inside the scrolling list, so the places card, the header and the pinned action row never move.
- `aroundme.read-from-cache` (default `false`) toggles whether places are served from the H2 cache: when `false` every request fetches fresh from Geoapify and forwards the result to the client, while the cache is still written (kept populated) but never read. Setting it to `true` restores the cache-first behavior.
- Each cached place records the origin of the fetch that produced it — the user's request coordinates (`fetch_lat`/`fetch_lon`) — so a coverage-aware cache-read algorithm can be built later. This metadata is internal and never returned to the client.
- Each returned place has a non-blank Geoapify name. Features without a usable `name` property are discarded during import and are neither returned nor cached.
- The client language (from the HTTP `Accept-Language` header) is passed to Geoapify so POI names can be returned in the user's language.
- Each place response includes the straight-line `distance` (meters) and an 8-point compass `direction` (`N, NE, E, SE, S, SW, W, NW`) from the requested coordinate — computed in the backend from the request lat/lon (the user's position); a place essentially at the user's location has an empty direction. The API always answers with the English abbreviation; the client maps it to the user's language (`direction.*` keys) before rendering, so a German, Spanish or French user sees `O`/`NO`/`SO` where English shows `E`/`NE`/`SE`.
- **Status:** fully integrated into the Locate view (0.4.0): all places returned by the backend (up to `aroundme.max-places` per category group) are shown with their distance and direction (e.g. `301 m NW`); the user can adopt a place as the location — its coordinates and label ("Name, street houseNumber") are then saved.

### 1.8. Installation (PWA)
- The application is installable as a Progressive Web App (web app manifest + service worker).
- Chrome/Brave on Android no longer show a native install banner; when the browser signals installability (`beforeinstallprompt`) the app shows its own dismissible banner at the top with an "Install" action that opens the native install dialog.
- The promotion is suppressed when the app already runs in standalone display mode or after the user has dismissed it (or installed it).
- On iOS Safari, which never fires `beforeinstallprompt`, a one-time "Add to Home Screen" hint is shown instead.
- The promotion text follows the application language (browser-detected on a first visit, otherwise the language chosen in Settings).

### 1.9. Release Notes ("What's New")
- The app keeps a compact, app-local summary of the latest release in all app languages (EN/DE/ES/FR); unsupported languages fall back to English.
- On app start, if the exact `APP_VERSION` differs from the last seen version, a native modal shows the latest release once. The first-ever launch never shows it; existing app state is recognised so upgrades are not mistaken for a fresh install. An active install banner suppresses it until a later launch. Build-only changes (`APP_BUILD`) do not trigger it.
- The dialog uses a fixed header and footer with an internally scrolling body, so longer release notes stay app-like and the close/action controls remain reachable.
- The dialog links to the full website release notes (EN/DE/ES); French users are linked to the English page.
- The application version shown in Settings is a button: tapping it re-opens this dialog on demand at any time, bypassing the once-per-version check (a second dialog is never stacked while one is open).

## 2. User Interface

The application is a single-page application (SPA) with three main views:

### 2.1. Locate View
- This is the main view of the application.
- On first open — and whenever no step is displayed (idle, GPS search or error) — it shows a muted, inert **outline of the chooser** (a ghost of the weather/address card and the "Places around me" list) with a short hint, so the view is never blank; the "Fetch Location" button sits at the bottom of this start screen.
- Fetching runs a GPS accuracy loop; once a fix is found, the view splits into two steps:
  - **Chooser step:** shows the current weather (temperature, condition, UV-Index), a selectable **Resolved Address** row (with elevation; always reserves two lines so the row height is stable) and a **"Places around me"** list of all POIs returned by the backend (up to `aroundme.max-places` per category group; the client renders every row and the list scrolls internally; category icon + name + distance in m/km and the 8-point direction in the user's language). Tourism sights and the legacy `tourism.attraction` rows use a dedicated camera icon; other tourism subcategories keep the generic tourism icon. Above the list, when at least two categories are present, a single-select icon-only filter row narrows the list to one category (see 1.7); the active chip shows its localized name and every new fetch starts unfiltered. Tapping a place selects it and unfolds its details (phone, website, opening hours, wheelchair) inside the list; tapping it again closes them while keeping the selection. The resolved address is selected by default. The user either keeps it or taps one of the place rows to adopt it as the location label — a chosen place is shown as `Name, <street> <houseNumber>`. A "Continue" button proceeds to the save step; the fetch button (now labelled "Refresh") shares the bottom row with it, on the left, and re-runs the GPS + preview fetch from the current coordinates. The places card stretches to fill the remaining space and the "Continue" button stays pinned at the bottom of the view; the places list scrolls internally only when its rows overflow, so the page itself never scrolls. The weather box is tappable: it expands a compact forecast grid (one column per forecast hour; rows TEMP / UV / RAIN — or SNOW when every hour is a snow code) and collapses again on a second tap; condition icons reflect day/night (sun/moon, sun+cloud, cloud+moon, cloud).
  - The **"Places around me"** header shows a small compass needle that points north while the user turns the device (device orientation). Without sensor data or permission it stays hidden; a one-time watchdog hint is logged to the console in that case.
  - **Save step:** shows the collapsible "Tag & Comment" section, the weather again, a **LOCATION** row with the chosen location (resolved address or adopted place) and the elevation (from the fetched weather data), and an OpenStreetMap snippet of the position that will be saved. When an adopted place carries contact data, a separate compact **PLACE DETAILS** box appears below the location/elevation card: phone (tap to call via `tel:` on Android/iOS), website (external link, displayed as its hostname), opening hours and wheelchair accessibility, each with an icon; the box stays hidden when none of these fields is present. On this step the fetch/refresh button is hidden (it is parked with the idle outline) and the "Preview from …" status line is hidden — the "Back" button returns to the chooser where a fresh fetch is available. "Save Location" persists the position; a "Back" button (same width, left of Save) returns to the chooser step without reloading data from the backend.
  - **Saved step:** after saving, a dedicated read-only confirmation card shows the persisted data in the same style — the tag (pill) and comment (read-only), weather, the **LOCATION** label, elevation and the map — with the fetch button (relabelled "Fetch Location") shown to the right of the "Back" button. A fresh fetch restarts the flow; the saved step fills the page, so its action row is pinned directly above the bottom navigation like the other steps. The "Preview from …" status line stays pinned at the top of the view on this step.
- The saved coordinates are the GPS fix by default; when the user adopts a place, the saved coordinates are that place's coordinates (its latitude/longitude) and the label is set to `Name, street houseNumber` (`osmName`), plus `displayName` and the place's road, house number, city and country. Weather, elevation and accuracy always come from the GPS preview.
- Before saving, a collapsible "TAG & COMMENT" section allows the user to select a single predefined tag and optionally enter a comment (max. 25 characters).

### 2.2. History View
- This view displays the user's saved locations.
- It has two modes: a list view and a map view.
- The list view shows a chronological list of saved locations.
- Each entry shows the resolved address across the full width of the tile.
- A tile can be expanded into a **details section** (rendered above the Map / Share / Delete buttons): a weather line with the temperature and the UV-Index pills, and a GPS line with a small satellite icon, the raw coordinates rounded to four decimals (e.g. `48.1372, 11.5755`) and the GPS accuracy pill (amber when the accuracy is worse than 30 m). Only one tile is expanded at a time; tapping it again collapses it.
- The elevation is shown as a muted pill in the expanded details row, in front of the coordinates pill (a small solid triangle + value, e.g. `▲ 521 m`).
- Each entry shows a tag as a pill next to the date and the comment as a line below the address (list mode only).
- **Share** (list tiles and map popups) hands over a message whose text starts with the app name — `locate.me: <address>` — followed by a Google Maps link to the coordinates, so the recipient can see where the message comes from before the link. Where the browser's share sheet is unavailable (desktop Firefox, embedded browsers) the same message, text plus link, is copied to the clipboard and the button briefly confirms with "Copied!".
- Each entry header shows a **direction badge** (list mode only): a small arrow pointing at the stored entry and the 8-point direction in the user's language (e.g. `NO` in German). The arrow points at the entry relative to the user's current position — the same GPS fix that the distance chip in the header and the travel times in the travel row are calculated from — so all three describe one and the same move; the letters are quantized to 8 points. The tooltip/accessible name names the direction in full (e.g. "Richtung: Nordosten"). The badge is omitted when no position is available (location permission denied or unavailable) and for an entry within 50 m of the user, where the 8-point letter is not meaningful and the arrow would only reflect GPS jitter; that range check is re-evaluated live as the user moves, so the badge reappears once they walk away. The distance chip (header) and the travel-time chips (travel row) are unaffected and stay visible.
- The direction arrows are **live while the History view is open**: they track the phone's orientation the same way the Locate needle does, and they follow the user as they walk. Turning the phone sweeps every arrow toward the screen edge the entry lies on, so the list behaves like a set of compass needles; walking re-aims them. Only the arrow moves with the phone — the letters stay absolute (a true compass direction), and so does the tooltip. Nothing is fetched: the arrows are recalculated from the entries already loaded, so they also work offline.
  - On iOS the motion-sensor permission is requested when the History tab is opened (the system prompt is unavoidable to enable this; it appears once).
  - If the motion-sensor permission is denied or the device has no compass sensor, the arrows stay fixed at the initial direction instead of failing — the rest of the list is unaffected.
  - Position updates are filtered: a new GPS fix is only used when it is reasonably accurate and the user actually moved a noticeable distance, so standing still does not drain the battery. Position tracking stops as soon as the user leaves the History view or switches to another app.
- Each entry header shows the distance to the saved location as a chip in front of the direction badge, formatted as metres below 1 km (`300 m`), one decimal up to 100 km (`1.2 km`) and rounded with a tilde above that (`~123 km`).
- Each entry shows a travel row with the walking, biking and driving times (mode icon + duration); for distances above 100 km the times are shown compactly with a tilde (e.g. `~58h`). Walking and biking assume a steady speed; the driving time grows less than proportionally with distance (a trip across town is not charged at motorway speed, and a long trip not at city speed) and includes a congestion allowance, so it is a plausible estimate rather than a navigation promise.
- Dates are shown relative to today: `Today`/`Yesterday`, then weekday names for the two following days (e.g. `Tuesday, 14:32`), and the full date for anything older.
- The map view shows all saved locations as markers on a map.
- Each location in the list can be deleted.

### 2.3. Settings View
- This view allows the user to configure the application.
- The user can set their `userId`.
- The user can toggle between light and dark mode.
- The user can select the application language — English (default), German, Spanish or French. On a first visit without a stored choice the language is auto-detected from the browser (`navigator.languages`/`navigator.language`, reduced to the primary subtag; English is the fallback) and is not persisted, so it keeps following the browser until the user makes an explicit choice. The choice is stored locally (`lang`) and applied in place (no page reload — a full reload in the installed Android PWA left the viewport mis-measured and clipped the bottom navigation until the app was killed); static and dynamic UI text is translated from flat JSON dictionaries (`frontend/locales/en.json`, `de.json`, `es.json`, `fr.json`) via a lean, framework-free lookup (`frontend/js/i18n.js`). Missing keys fall back to English. The app name "locate.me" and the predefined tag vocabulary (`HOME`, `WORK`, …) stay in English (the backend only understands the English tags); the selected language is additionally sent as `Accept-Language` for the "Places around me" request so POI names come back localized.
- The view also displays the application version and links to the used services (OpenStreetMap, Leaflet, Open-Meteo). Tapping the version re-opens the release notes dialog.
- Below the backend version/"online since" information it shows the server origin the app talks to (e.g. `https://app.locate-me.net` in production, `http://localhost:8090` for the local dev backend) — plain text, also visible while the backend is unreachable.

### 2.4. Install Prompt
- A dismissible banner appears at the **top** of the app (over the header) to promote installation. On Android Chrome/Brave it is driven by the browser's `beforeinstallprompt` event; tapping "Install" opens the native install dialog and hides the banner. The event is captured in `index.html` before the module loads and consumed by `frontend/js/ui/install.js`.
- Dismissal and successful installation are remembered (`localStorage`); the banner is never shown when the app already runs in standalone display mode.
- On iOS Safari a one-time hint explains "Tap Share, then Add to Home Screen" (dismissal also remembered). The hint is not shown in an already-installed (standalone) window.
- The banner/hint text follows the current application language: browser-detected on a first visit, otherwise the Settings choice.

## 3. Backend Services

The backend provides a REST API with the following endpoints:

- `POST /positions?userId={userId}`: Persists a new position for a user. The full position data (coordinates, address, weather, UV index, elevation) is supplied by the client in the request body; the backend stores it as-is without server-side resolution.
- `DELETE /positions/{id}?userId={userId}`: Deletes a position by its ID.
- `GET /positions?userId={userId}&lat={lat}&lon={lon}`: Retrieves all positions for a user. If `lat` and `lon` are provided, it also calculates the distance and travel times (walking, biking, driving) to each position.
- `GET /positions/current?userId={userId}&lat={lat}&lon={lon}`: Resolves the address (Nominatim) and weather/UV/elevation plus a short hourly forecast (Open-Meteo) for the given coordinates and returns a preview without persisting it. This is used by the Locate view to fetch the current location before saving.
- `GET /places?userId={userId}&lat={lat}&lon={lon}`: Returns cached places around the given coordinate, nearest-first. On a cache miss the backend fetches from the Geoapify Places API — one request per `|`-separated category group — combines the results (deduplicated by place ID) and stores them. An optional `Accept-Language` header selects the language of POI names. Each place includes a response-only `distance` (meters) to the given coordinate.
- `GET /positions/stats?adminKey={adminKey}`: Admin-only. Returns the total number of stored positions together with the number per user as `{"total": ..., "perUser": [{"userId": ..., "locations": ...}]}` (`perUser` ordered by `userId`). Requires the `adminKey` query parameter to match the configured `admin.key` (overridable via the `ADMIN_KEY` environment variable); a missing or mismatched key returns `401 Unauthorized`. Not rate-limited.
- `GET /places/stats?adminKey={adminKey}`: Admin-only. Returns the number of entries in the places cache together with a per-city breakdown as `{"count": ..., "perCity": [{"city": ..., "places": ...}]}` (`perCity` ordered by `city`). Places without a city are included in `count` but omitted from `perCity`. Requires the `adminKey` query parameter (same check as above); a missing or mismatched key returns `401 Unauthorized`. Not rate-limited.

Position responses include the persisted weather-related fields `temperature`, `weatherCode`, `uvIndex`, and `elevation`. The `/positions/current` preview additionally returns a response-only `isDay` flag for the current conditions and a `forecast` array with the next `weather.forecast-hours` future hours (the current hour is skipped); each slice carries `time`, `temperature`, `weatherCode`, `uvIndex`, `precipitationProbability` and `isDay`. Neither `isDay` nor `forecast` is persisted, and they are not returned by the other endpoints. No new endpoints were introduced for UV-Index and elevation; they are persisted and returned by the existing endpoints above.

`tag` and `comment` are optional fields: when set on a save (`POST /positions`) they are persisted verbatim and returned in position responses; when absent they are simply not stored.

Geocoding/weather enrichment happens only when fetching (`GET /positions/current`). Saving (`POST /positions`) persists the client-provided data verbatim – the Locate view sends back exactly the enriched preview data it already fetched, so the backend never re-resolves an already-fetched location.

**Rate limiting:** to protect the backend from request flooding, the read operations
(`GET /positions`, `GET /positions/current`, `GET /places`) and the write/delete
operations (`POST /positions`, `DELETE /positions/{id}`) are rate-limited per user
(token-bucket). When a limit is exceeded the backend answers
`429 Too Many Requests` with a `Retry-After` header and a JSON body
(`{"error":"TOO_MANY_REQUESTS","status":429}`); the frontend shows a friendly
message and keeps the backend status online. `GET /api/system/info` is exempt so
the online/offline status indicator stays reliable, and the admin-only stats
endpoints (`GET /positions/stats`, `GET /places/stats`) are exempt as they require
the secret `adminKey`. Limits:
`pwa-standard` = 10 reads / 30 s, `pwa-critical` = 5 writes+deletes / 30 s, both as
shared pools keyed by `userId`.

On top of these per-user request limits, outgoing calls to external services are
protected by **global** token buckets shared by all users, because the providers
limit per API key or source IP: Geoapify 2 calls/s (below its 3 calls/s limit),
Nominatim 1 call/s and Open-Meteo 5 calls/s. A call may wait up to 5 s for a
token; if the wait is exhausted, the request returns the same
`429 Too Many Requests` response. The external limits are configurable via the
`external-api.*` properties.

## 4. Business Objects

The main business object is the `Position` entity, which has the following attributes:

- `id`: The primary key.
- `userId`: The user who owns this position.
- `latitude`, `longitude`: The coordinates of the position.
- `accuracy`: The accuracy of the coordinates.
- `displayName`: A human-readable name for the position — the address composed from road + house number, city and country; for a position adopted from "Places around me" it is the place's formatted Geoapify address.
- `temperature`, `weatherCode`: Weather information.
- `uvIndex`: The current UV-Index at the position.
- `elevation`: The elevation of the position in meters.
- The `/positions/current` preview's `forecast` array and `isDay` flag are display-only and are not attributes of the persisted `Position`.
- `timestamp`: When the position was recorded.
- `osmCategory`, `osmType`, `addressType`, `houseNumber`, `road`, `city`, `country`: Geocoding information from OpenStreetMap (the POI metadata drives the location icon, while the address parts feed `displayName` and the short address).
- `osmName`: The label of a place the user adopted from "Places around me" (`Name, street houseNumber`); it is not filled by reverse geocoding, so geocoding never stores a POI name.
- `tag`: An optional predefined tag for the position (`HOME`, `WORK`, `PARKING`, `SHOPPING`, `EATING`, `LEISURE`, `FRIENDS`, `HEALTH`).
- `comment`: An optional user-provided comment (max. 25 characters in the UI, 255 in the database).

A second business object is the `Place`, which represents a cached point of interest fetched from Geoapify:

- `placeId`: The primary key (the Geoapify place ID).
- `cachedAt`: When the place was last (re-)fetched.
- `geohash`: A 9-character geohash of the coordinates.
- `latitude`, `longitude`: The coordinates of the place.
- `name`: The Geoapify display name; never blank. Features without a usable `name` are discarded during import, so no synthetic fallback names are stored.
- `primaryCategory`, `secondaryCategory`: The POI category (e.g. leisure / playground).
- `formattedAddress`, `street`, `houseNumber`, `postcode`, `city`, `country`: Address attributes.
- `phone`, `website`, `openingHours`, `wheelchair`: Additional POI metadata.

### 4.1. Managing the Tag Vocabulary (`PositionTag`)

The selectable tags are defined by the `PositionTag` enum on the backend and mirrored in the `PREDEFINED_TAGS` list in the frontend (`frontend/js/pages/locate.js`).

**Important – the database column type:** Since 0.4.0 the schema is managed by Flyway and `V1__baseline.sql` defines `tag` as `VARCHAR(32)` directly, so adding tags no longer requires a column conversion. For **pre-0.4.0** databases (converted during the 0.3.0 rollout) the column is already `VARCHAR(32)`. Note: on those older databases the column originally existed as an H2 native `ENUM` whose allowed values were fixed at column creation — changing the vocabulary did not update the column and saving a new tag value failed with HTTP 500. The column was converted to a plain `VARCHAR` once per existing database (backend stopped first, the H2 file is locked while it runs):

```sql
ALTER TABLE positions ALTER COLUMN tag SET DATA TYPE VARCHAR(32) USING (CAST(tag AS VARCHAR));
```

**Adding a tag**
1. Add the new value to the `PositionTag` enum (backend, `locator/entity` package). No database change is needed — the `tag` column is `VARCHAR(32)`.
2. Add the same value to `PREDEFINED_TAGS` in `frontend/js/pages/locate.js` — the tag chips in the Locate view are generated from this list.
3. Redeploy backend and frontend together (backend first). The backend rejects unknown tags with `400 Bad Request`, so a tag can only be saved once both sides know it.

**Removing a tag**
Removing the enum constant is only safe once no saved position still uses the tag: the backend maps the stored value back to the enum on every read, and an unknown value breaks loading the affected history entries.
- Recommended: remove the tag only from `PREDEFINED_TAGS` (frontend). It can then no longer be selected for new saves, while already-saved entries keep their tag pill (the History view shows the stored value without checking the list).
- Full removal: first clear the existing values in the database (`UPDATE positions SET tag = NULL WHERE tag = '<TAG>'`), then remove the enum constant from the backend.

## 5. BCE Architecture

The backend is structured according to the BCE (Boundary-Control-Entity) principle:
every functional area is implemented as a set of boundaries (REST resources),
controls (business logic) and entities (business objects). This documentation
describes the system from a functional point of view; the complete technical
component breakdown lives in `docs/technical-landscape.md` → ECB Architecture.
Each feature — `locator` for positions, `aroundme` for places — is a separate BCE
component.

## 6. Change Log

The change log has moved to [docs/changelog.md](changelog.md) → [Functional Change Log](changelog.md#functional-change-log).
