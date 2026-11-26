import { API_BASE_URL, API_PATH } from './config.js?v=0.3.1_34';
import { t, getLanguage } from './i18n.js';
import { clearSession, getToken } from './auth.js';

/* ==========================================================================
   Internal: build a typed Error for HTTP 429 (rate limited). Carries
   status=429 and the Retry-After header value (seconds) so callers can show
   a friendly message and/or schedule a retry.
   ========================================================================== */
function tooManyRequestsError(response) {
    const header = response.headers.get('Retry-After');
    const retryAfter = header ? parseInt(header, 10) : null;
    const error = new Error(t('errors.tooManyRequests'));
    error.status = 429;
    error.retryAfter = Number.isNaN(retryAfter) ? null : retryAfter;
    return error;
}

/* ==========================================================================
   Internal: fetch for the authenticated business endpoints. A stored session
   adds the bearer token; the backend then derives the identity from the token
   and ignores the userId query parameter (kept for the service-worker cache
   key). A 401 means the current identity can no longer authenticate — the
   token was rejected, or it had already expired and was dropped by
   readSession() — so the session is cleared and the auth gate takes over
   instead of the app silently falling back to the legacy parameter.
   ========================================================================== */
async function authorizedFetch(url, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}) };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        clearSession();
        window.dispatchEvent(new Event('locateme:session-expired'));
    }
    return response;
}

/* ==========================================================================
   Internal: the public auth endpoints never send the bearer token (a stale
   token on /auth/login must not be treated as an authentication attempt) and
   a 401 is a credentials error, not a session expiry.
   ========================================================================== */
async function postAuth(path, payload) {
    const response = await fetch(`${API_BASE_URL}${API_PATH}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (response.status === 429) throw tooManyRequestsError(response);

    if (!response.ok) {
        let serverMessage = null;
        try {
            const body = await response.json();
            serverMessage = body && body.error ? body.error : null;
        } catch (e) {
            /* no JSON body – use the status below */
        }
        const error = new Error(serverMessage || `Server returned status ${response.status}`);
        error.status = response.status;
        error.serverMessage = serverMessage;
        throw error;
    }
    return response.json();
}

/* ==========================================================================
   POST /api/auth/register – create an account and return the token envelope.
   ========================================================================== */
export async function apiRegister(payload) {
    return postAuth('/auth/register', payload);
}

/* ==========================================================================
   POST /api/auth/login – verify credentials and return the token envelope.
   ========================================================================== */
export async function apiLogin(payload) {
    return postAuth('/auth/login', payload);
}

/* ==========================================================================
   POST /api/auth/claim – one-time migration of an imported legacy account.
   ========================================================================== */
export async function apiClaim(payload) {
    return postAuth('/auth/claim', payload);
}

/* ==========================================================================
   GET /api/auth/migration-status/{userId}
   Returns: { migrationRequired: boolean }
   ========================================================================== */
export async function apiMigrationStatus(userId) {
    const url = `${API_BASE_URL}${API_PATH}/auth/migration-status/${encodeURIComponent(userId)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (response.status === 429) throw tooManyRequestsError(response);
        if (!response.ok) {
            const error = new Error(`Server returned status ${response.status}`);
            error.status = response.status;
            throw error;
        }
        return response.json();
    } finally {
        clearTimeout(timeoutId);
    }
}

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

    if (response.status === 429) throw tooManyRequestsError(response);
    if (!response.ok) throw new Error(t('errors.backendStatus'));
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

    const response = await authorizedFetch(url);
    if (response.status === 429) throw tooManyRequestsError(response);
    if (!response.ok) throw new Error(t('errors.fetchHistory'));
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

    const response = await authorizedFetch(url);
    if (response.status === 429) throw tooManyRequestsError(response);
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

    const response = await authorizedFetch(url, {
        headers: { 'Accept-Language': getLanguage() }
    });
    if (response.status === 429) throw tooManyRequestsError(response);
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
    const response = await authorizedFetch(
        `${API_BASE_URL}${API_PATH}/positions?userId=${encodeURIComponent(userId)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }
    );
    if (response.status === 429) throw tooManyRequestsError(response);
    if (!response.ok) throw new Error(`Server returned status ${response.status}`);
    return response.json();
}

/* ==========================================================================
   DELETE /api/positions/{id}
   Throws on network error or non-ok response.
   ========================================================================== */
export async function apiDeletePosition(userId, id) {
    const response = await authorizedFetch(
        `${API_BASE_URL}${API_PATH}/positions/${id}?userId=${encodeURIComponent(userId)}`,
        { method: 'DELETE' }
    );
    if (response.status === 429) throw tooManyRequestsError(response);
    if (!response.ok) throw new Error(t('errors.removeRecord'));
}
