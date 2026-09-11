/* ==========================================================================
   Application State
   Alle mutablen Zustandsvariablen der App zentral verwaltet.
   Zugriff ausschließlich über die exportierten Getter/Setter.
   ========================================================================== */

// --- History Map State ---
let _historyMap = null;           // Leaflet map instance (lazy init)
let _historyMapData = [];         // Last fetched positions, shared with map renderer
let _currentHistoryView = 'list'; // 'list' | 'map'
let _historyFilter = { tag: '', text: '' }; // Active history filter { tag, text } (shared List <-> Map)

// --- Locate Page State ---
let _cachedLocatePosition = null; // Enriched preview payload from GET /positions/current (+ GPS accuracy) for the Save-Button
let _locateMap = null;            // Leaflet map instance für Locate-Seite (lazy init)
let _locateMarker = null;         // Einzelner Marker auf der Locate-Karte
let _locateSavedMap = null;       // Leaflet map instance für die Saved-Ansicht (lazy init)
let _locateSavedMarker = null;    // Einzelner Marker auf der Saved-Karte

// --- History Map Getter/Setter ---
export function getHistoryMap()          { return _historyMap; }
export function setHistoryMap(val)       { _historyMap = val; }

export function getHistoryMapData()      { return _historyMapData; }
export function setHistoryMapData(val)   { _historyMapData = val; }

export function getCurrentHistoryView()      { return _currentHistoryView; }
export function setCurrentHistoryView(val)   { _currentHistoryView = val; }

export function getHistoryFilter()       { return _historyFilter; }
export function setHistoryFilter(val)    { _historyFilter = val; }

// --- Locate Page Getter/Setter ---
export function getCachedLocatePosition()      { return _cachedLocatePosition; }
export function setCachedLocatePosition(val)   { _cachedLocatePosition = val; }

export function getLocateMap()          { return _locateMap; }
export function setLocateMap(val)       { _locateMap = val; }

export function getLocateMarker()       { return _locateMarker; }
export function setLocateMarker(val)    { _locateMarker = val; }

export function getLocateSavedMap()     { return _locateSavedMap; }
export function setLocateSavedMap(val)  { _locateSavedMap = val; }

export function getLocateSavedMarker()  { return _locateSavedMarker; }
export function setLocateSavedMarker(val) { _locateSavedMarker = val; }

// --- Last Known GPS Fix (localStorage, per user) ---
// Wird bei jedem erfolgreichen Preview gespeichert und dient als Fallback,
// wenn kein GPS-Signal verfügbar ist (z.B. U-Bahn). Lokal und pro User.
const LAST_FIX_PREFIX = 'locate.me.lastFix.';

export function getLastKnownFix(userId) {
    try {
        const raw = localStorage.getItem(LAST_FIX_PREFIX + userId);
        if (!raw) return null;
        const fix = JSON.parse(raw);
        if (!fix || typeof fix.latitude !== 'number' || typeof fix.longitude !== 'number') return null;
        return fix;
    } catch (e) {
        return null;
    }
}

export function setLastKnownFix(userId, fix) {
    try {
        localStorage.setItem(LAST_FIX_PREFIX + userId, JSON.stringify(fix));
    } catch (e) {
        /* quota / private mode – ignorieren */
    }
}