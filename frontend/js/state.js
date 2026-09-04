/* ==========================================================================
   Application State
   Alle mutablen Zustandsvariablen der App zentral verwaltet.
   Zugriff ausschließlich über die exportierten Getter/Setter.
   ========================================================================== */

// --- History Map State ---
let _historyMap = null;           // Leaflet map instance (lazy init)
let _historyMapData = [];         // Last fetched positions, shared with map renderer
let _currentHistoryView = 'list'; // 'list' | 'map'
let _historyFilterTerm = '';      // Active history filter term (shared List <-> Map)

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

export function getHistoryFilterTerm()       { return _historyFilterTerm; }
export function setHistoryFilterTerm(val)    { _historyFilterTerm = val; }

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