/* ==========================================================================
   locate.me – Authentication session (bearer token) storage
   The backend is stateless: the only thing a client keeps is the signed JWT
   returned by /auth/register, /auth/login or /auth/claim, plus its expiry and
   the userId it belongs to. There is no refresh token and no server-side
   session, so the token is simply dropped when it is expired or the active
   identity changes.
   ========================================================================== */

const SESSION_KEY = 'locate-me.auth';
const DEMO_USER_ID = 'user123';

/* Mirrors app.js: the stored userId, or the shared demo identity. */
function activeUserId() {
    const saved = localStorage.getItem('userId');
    return (saved && saved.trim() !== '') ? saved.trim() : DEMO_USER_ID;
}

/* ==========================================================================
   Read the stored session. Returns null when it is missing, malformed,
   expired, or belongs to another identity. Expired/inconsistent sessions are
   removed so a stale token can never be used silently.
   ========================================================================== */
export function readSession() {
    let raw;
    try {
        raw = localStorage.getItem(SESSION_KEY);
    } catch (e) {
        return null;
    }
    if (!raw) return null;

    let session;
    try {
        session = JSON.parse(raw);
    } catch (e) {
        clearSession();
        return null;
    }

    if (!session
        || typeof session.token !== 'string' || session.token === ''
        || typeof session.userId !== 'string' || session.userId === ''
        || typeof session.expiresAt !== 'string') {
        clearSession();
        return null;
    }

    const expires = Date.parse(session.expiresAt);
    if (!Number.isFinite(expires) || expires <= Date.now()) {
        clearSession();
        return null;
    }

    // The identity can be changed from Settings or by using the demo; a token
    // of another account must never authenticate the new identity.
    if (session.userId.toLowerCase() !== activeUserId().toLowerCase()) {
        clearSession();
        return null;
    }

    return session;
}

export function getToken() {
    const session = readSession();
    return session ? session.token : null;
}

export function isAuthenticated() {
    return readSession() !== null;
}

/* ==========================================================================
   Store the token envelope returned by the backend. The caller sets the active
   userId first, so readSession() accepts the new identity immediately.
   ========================================================================== */
export function saveSession({ token, userId, expiresAt }) {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            token: String(token || ''),
            userId: String(userId || ''),
            expiresAt: String(expiresAt || '')
        }));
    } catch (e) {
        /* localStorage unavailable – the app stays usable in legacy/demo mode */
    }
}

export function clearSession() {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch (e) {
        /* nothing to clear */
    }
}
