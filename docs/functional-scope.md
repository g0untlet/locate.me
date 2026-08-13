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
- For each saved location, the straight-line distance and the estimated travel times for walking, biking and driving are displayed.

### 1.4. Weather Information
- For a given location, the application fetches and displays the current temperature and weather conditions.
- The current UV-Index is also fetched and displayed.
- This is done by an external API (Open-Meteo).

### 1.5. Elevation Information
- For a given location, the application fetches and displays the elevation (meters above sea level).
- The elevation is retrieved from the Open-Meteo API together with the weather data.
- In the Locate view it is shown as a separate value below the address; in the History view it is shown inline with the address (e.g. `Isartorplatz, München, Deutschland (521 m)`).

### 1.6. Geocoding
- For a given location, the application fetches and displays the corresponding address.
- This is done by an external API (OpenStreetMap/Nominatim).

## 2. User Interface

The application is a single-page application (SPA) with three main views:

### 2.1. Locate View
- This is the main view of the application.
- It displays a button to fetch the current location.
- When the location is fetched, it is displayed on a map.
- The view also shows the current weather and address information.
- The current UV-Index and the elevation are displayed alongside the address.
- A "Save Location" button allows the user to save the current location to their history.
- Before saving, a collapsible "TAG & COMMENT" section allows the user to select a single predefined tag and optionally enter a comment (max. 25 characters).
- After saving, the chosen tag and comment are shown at the top of the location card, above the temperature section.

### 2.2. History View
- This view displays the user's saved locations.
- It has two modes: a list view and a map view.
- The list view shows a chronological list of saved locations.
- Each entry shows the address, the temperature and a UV-Index badge.
- The elevation is displayed inline with the address as a muted footnote (e.g. `(521 m)`).
- Each entry shows the tag as a pill next to the date and the comment as a line below the address (list mode only).
- Each entry shows a travel row with the walking, biking and driving times (mode icon + duration) and the distance as a chip; for distances above 100 km the values are shown compactly with a tilde (e.g. `~109 km`, `~58h`).
- Dates are shown relative to today: `Today`/`Yesterday`, then weekday names for the two following days (e.g. `Tuesday, 14:32`), and the full date for anything older.
- The map view shows all saved locations as markers on a map.
- Each location in the list can be deleted.

### 2.3. Settings View
- This view allows the user to configure the application.
- The user can set their `userId`.
- The user can toggle between light and dark mode.
- The view also displays the application version and links to the used services (OpenStreetMap, Leaflet, Open-Meteo).

## 3. Backend Services

The backend provides a REST API with the following endpoints:

- `POST /positions?userId={userId}`: Persists a new position for a user. The full position data (coordinates, address, weather, UV index, elevation) is supplied by the client in the request body; the backend stores it as-is without server-side resolution.
- `DELETE /positions/{id}?userId={userId}`: Deletes a position by its ID.
- `GET /positions?userId={userId}&lat={lat}&lon={lon}`: Retrieves all positions for a user. If `lat` and `lon` are provided, it also calculates the distance and travel times (walking, biking, driving) to each position.
- `GET /positions/current?userId={userId}&lat={lat}&lon={lon}`: Resolves the address (Nominatim) and weather/UV/elevation (Open-Meteo) for the given coordinates and returns a preview without persisting it. This is used by the Locate view to fetch the current location before saving.

Position responses include the weather-related fields `temperature`, `weatherCode`, `uvIndex`, and `elevation`. No new endpoints were introduced for UV-Index and elevation; they are persisted and returned by the existing endpoints above.

`tag` and `comment` are optional fields: when set on a save (`POST /positions`) they are persisted verbatim and returned in position responses; when absent they are simply not stored.

Geocoding/weather enrichment happens only when fetching (`GET /positions/current`). Saving (`POST /positions`) persists the client-provided data verbatim – the Locate view sends back exactly the enriched preview data it already fetched, so the backend never re-resolves an already-fetched location.

## 4. Business Objects

The main business object is the `Position` entity, which has the following attributes:

- `id`: The primary key.
- `userId`: The user who owns this position.
- `latitude`, `longitude`: The coordinates of the position.
- `accuracy`: The accuracy of the coordinates.
- `displayName`: A human-readable name for the position.
- `temperature`, `weatherCode`: Weather information.
- `uvIndex`: The current UV-Index at the position.
- `elevation`: The elevation of the position in meters.
- `timestamp`: When the position was recorded.
- `osmCategory`, `osmType`, `osmName`, `addressType`, `houseNumber`, `road`, `city`, `country`: Geocoding information from OpenStreetMap.
- `tag`: An optional predefined tag for the position (`HOME`, `WORK`, `PARKING`, `SHOPPING`, `EATING`, `LEISURE`, `FRIENDS`, `HEALTH`).
- `comment`: An optional user-provided comment (max. 25 characters in the UI, 255 in the database).

### 4.1. Managing the Tag Vocabulary (`PositionTag`)

The selectable tags are defined by the `PositionTag` enum on the backend and mirrored in the `PREDEFINED_TAGS` list in the frontend (`frontend/js/pages/locate.js`).

**Important – the database column type:** Hibernate creates the `tag` column as an H2 native `ENUM` whose allowed values are fixed when the column is created. Changing the vocabulary in the `PositionTag` enum does **not** update an existing column — saving a new tag value then fails with HTTP 500. The column must therefore be converted to a plain `VARCHAR` once per existing database (backend stopped first, the H2 file is locked while it runs):

```sql
ALTER TABLE positions ALTER COLUMN tag SET DATA TYPE VARCHAR(32) USING (CAST(tag AS VARCHAR));
```

**Adding a tag**
1. Convert the `tag` column to `VARCHAR` (see above) if not already done.
2. Add the new value to the `PositionTag` enum (backend, `locator/entity` package).
3. Add the same value to `PREDEFINED_TAGS` in `frontend/js/pages/locate.js` — the tag chips in the Locate view are generated from this list.
4. Redeploy backend and frontend together (backend first). The backend rejects unknown tags with `400 Bad Request`, so a tag can only be saved once both sides know it.

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

## 6. Change Log

| Version | Date | Description |
|---------|------|-------------|
| 0.3.0 | 2026-08-03 | Added UV-Index and elevation fields to the `Position` entity (fetched from Open-Meteo); display UV-Index and elevation in the Locate and History views; fixed HTTP 500 on saving a location caused by an H2 2.4.240 enum CHECK constraint regression (see `docs/production-upgrade-0.3.0.md`). |
| 0.3.0 | 2026-08-10 | Documentation alignment: technical details (incl. the BCE component breakdown) moved to `docs/technical-landscape.md`. |
| 0.3.0 | 2026-08-10 | Save flow refactored: the Locate view now POSTs the already-fetched enriched data back to `POST /positions`, which persists it verbatim without re-resolving geocoding/weather. Enrichment happens only during `GET /positions/current`. |
| 0.3.0 | 2026-08-11 | Added optional tag and comment when saving a location: single-select predefined tag chips and a 25-character comment in the Locate view; shown as a tag pill + comment line in the History list and at the top of the saved-location card. |
| 0.3.0 | 2026-08-11 | Tag vocabulary revised for long-term stability: `HOME, WORK, PARKING, SHOPPING, EATING, LEISURE, FRIENDS, HEALTH` (replaced `RESTAURANT`, `EDU`, `POI`; one activity-based axis). No tag data existed in the databases, so no migration was required. |
| 0.3.0 | 2026-08-11 | Fixed HTTP 500 when saving new tag values: the `tag` column existed as an H2 native `ENUM` with the old value list baked in; converted it to `VARCHAR` on the DEV database (see §4.1). |
| 0.3.0 | 2026-08-12 | `GET /positions?userId=&lat=&lon=` now additionally returns the distance (km) and travel times for walking, biking and driving (response-only, not persisted), computed via Haversine distance plus speed assumptions (walking 4.8 km/h ×1.35, biking 16.5 km/h ×1.25, driving by distance band). |
| 0.3.0 | 2026-08-12 | History cards now show travel-time chips (walk/bike/drive icons + time) and the distance in a dedicated always-aligned bottom row; travel times are shown compactly (e.g. `~58h`) for distances above 100 km. |
| 0.3.0 | 2026-08-12 | History-card refinements: walk icon replaced with a sneaker; the distance is rendered as a neutral chip and rounded compactly (e.g. `~109 km`) above 100 km; the two days after yesterday show their weekday name (e.g. `Tuesday, 14:32`); cards use a stronger border (`--card-border`) in light and dark mode; the temperature-pill weather icon was resized to match the UV pill height. |
