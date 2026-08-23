import { API_BASE_URL, API_PATH } from './config.js?v=0.3.1_34';

/* ==========================================================================
   GET /api/system/info
   Returns: { artifactId, version, startupTime }
   Throws on network error or non-ok response.
   ========================================================================== */
export async function apiGetSystemInfo() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${API_BASE_URL}${API_PATH}/system/info`, {
        signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error("Backend answered with error status code");
    return response.json();
}

/* ==========================================================================
   GET /api/positions
   lat/lon optional – wenn übergeben, berechnet Backend Distanz + Walkingtime.
   Returns: Array of position objects.
   Throws on network error or non-ok response.
   ========================================================================== */
export async function apiGetPositions(userId, lat = null, lon = null) {
    return (await apiGetPositionsWithMeta(userId, lat, lon)).data;
}

/* ==========================================================================
   GET /api/positions – wie apiGetPositions, liefert zusätzlich das
   fromCache-Flag (X-LocateMe-Cache-Header vom Service Worker), damit die UI
   offline angezeigte, gecachte History kennzeichnen kann.
   Returns: { data, fromCache }.
   Throws on network error or non-ok response.
   ========================================================================== */
export async function apiGetPositionsWithMeta(userId, lat = null, lon = null) {
    let url = `${API_BASE_URL}${API_PATH}/positions?userId=${encodeURIComponent(userId)}`;
    if (lat !== null && lon !== null) {
        url += `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error("Could not fetch history");
    const data = await response.json();
    return { data, fromCache: response.headers.get('X-LocateMe-Cache') === '1' };
}

/* ==========================================================================
   GET /api/positions/current
   Liefert Preview-Daten inkl. Wetter für die aktuelle GPS-Position.
   Returns: position object mit weather-Feldern.
   Throws on network error or non-ok response.
   ========================================================================== */
export async function apiGetCurrentPosition(userId, lat, lon) {
    const url = `${API_BASE_URL}${API_PATH}/positions/current` +
        `?userId=${encodeURIComponent(userId)}&lat=${lat}&lon=${lon}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Server returned status ${response.status}`);
    return response.json();
}

/* ==========================================================================
   GET /api/places (AroundMe)
   Liefert die nächsten POIs um die GPS-Position (distanzsortiert, aufsteigend).
   Returns: Array of place objects, jeweils mit distance (Meter).
   Throws on network error or non-ok response.
   ========================================================================== */
export async function apiGetPlaces(userId, lat, lon) {
    const url = `${API_BASE_URL}${API_PATH}/places` +
        `?userId=${encodeURIComponent(userId)}&lat=${lat}&lon=${lon}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Server returned status ${response.status}`);
    return response.json();
}

/* ==========================================================================
   POST /api/positions
   Speichert eine neue Position.
   Returns: gespeichertes position object inkl. Wetter-Daten vom Backend.
   Throws on network error or non-ok response.
   ========================================================================== */
export async function apiPostPosition(userId, payload) {
    const response = await fetch(
        `${API_BASE_URL}${API_PATH}/positions?userId=${encodeURIComponent(userId)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }
    );
    if (!response.ok) throw new Error(`Server returned status ${response.status}`);
    return response.json();
}

/* ==========================================================================
   DELETE /api/positions/{id}
   Throws on network error or non-ok response.
   ========================================================================== */
export async function apiDeletePosition(userId, id) {
    const response = await fetch(
        `${API_BASE_URL}${API_PATH}/positions/${id}?userId=${encodeURIComponent(userId)}`,
        { method: 'DELETE' }
    );
    if (!response.ok) throw new Error("Could not process record removal");
}