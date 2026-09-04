import {
    getHistoryMap, setHistoryMap,
    getHistoryMapData,
    getHistoryFilterTerm,
    getCurrentHistoryView, setCurrentHistoryView,
    getLocateMap, setLocateMap,
    getLocateMarker, setLocateMarker,
    getLocateSavedMap, setLocateSavedMap,
    getLocateSavedMarker, setLocateSavedMarker
} from '../state.js';
import { formatShortAddress, formatRelativeDate, posMatchesFilter } from '../utils.js';

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/* ==========================================================================
   History View: List <-> Map Toggle
   ========================================================================== */
export function setHistoryView(view) {
    setCurrentHistoryView(view);
    const listEl  = document.getElementById('history-list');
    const mapEl   = document.getElementById('history-map');
    const listBtn = document.getElementById('toggle-list-btn');
    const mapBtn  = document.getElementById('toggle-map-btn');
    if (!listEl || !mapEl || !listBtn || !mapBtn) return;

    if (view === 'map') {
        listEl.classList.add('hidden');
        mapEl.classList.remove('hidden');
        listBtn.classList.remove('view-toggle-btn--active');
        mapBtn.classList.add('view-toggle-btn--active');
        initOrRefreshMap();
    } else {
        mapEl.classList.add('hidden');
        listEl.classList.remove('hidden');
        mapBtn.classList.remove('view-toggle-btn--active');
        listBtn.classList.add('view-toggle-btn--active');
    }
}

/* ==========================================================================
   History Map: Lazy Init + invalidateSize
   ========================================================================== */
function initOrRefreshMap() {
    const mapEl = document.getElementById('history-map');
    if (!mapEl) return;

    // Leaflet (global L) may be missing on pages loaded while offline before the
    // first online visit. Degrade gracefully instead of crashing.
    if (typeof L === 'undefined') {
        console.warn('Leaflet not loaded – history map unavailable.');
        return;
    }

    if (!getHistoryMap()) {
        const map = L.map('history-map', { zoomControl: true });
        L.tileLayer(OSM_TILE_URL, { attribution: OSM_ATTRIBUTION, maxZoom: 19 }).addTo(map);
        setHistoryMap(map);
    }

    // invalidateSize fixes rendering in previously hidden containers
    setTimeout(() => {
        getHistoryMap().invalidateSize();
        renderMapMarkers();
    }, 50);
}

/* ==========================================================================
   History Map: Marker Rendering
   Nummerierte divIcon-Marker über dem vollen Datensatz. Ein aktiver
   Filter-Term (identisch zur List-View, posMatchesFilter) blendet nicht
   passende Pins aus; die Nummer entspricht weiterhin der Position im vollen
   Array (+1) und damit der Nummerierung in der List-View.
   ========================================================================== */
export function renderMapMarkers() {
    const map = getHistoryMap();
    if (!map) return;
    if (typeof L === 'undefined') return;

    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    const data = getHistoryMapData();
    if (!data || data.length === 0) return;

    const filterTerm = (getHistoryFilterTerm() || '').trim();
    const bounds = [];

    data.forEach((pos, index) => {
        if (!posMatchesFilter(pos, filterTerm)) return;
        if (!pos.latitude || !pos.longitude) return;

        const lat = parseFloat(pos.latitude);
        const lon = parseFloat(pos.longitude);
        if (isNaN(lat) || isNaN(lon)) return;

        const shortAddr    = formatShortAddress(pos);
        const dateFormatted = formatRelativeDate(pos.timestamp);
        const mapsUrl      = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
        const escapedAddr  = shortAddr.replace(/"/g, '&quot;');

        const numberedIcon = L.divIcon({
            className: 'history-pin-wrapper',
            html: `<div class="history-pin">${index + 1}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
        });

        const marker = L.marker([lat, lon], { icon: numberedIcon }).addTo(map);
        marker.bindPopup(
            `<div class="map-popup">` +
            `<span class="map-popup-index">#${index + 1}</span>` +
            `<span class="map-popup-address">${shortAddr}</span>` +
            `<span class="map-popup-date">${dateFormatted}</span>` +
            `<button class="map-popup-share" data-lat="${lat}" data-lon="${lon}" data-address="${escapedAddr}" data-maps-url="${mapsUrl}">` +
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
            `<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle>` +
            `<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>` +
            `Share</button>` +
            `</div>`,
            { maxWidth: 220 }
        );
        bounds.push([lat, lon]);
    });

    if (bounds.length === 1) {
        map.setView(bounds[0], 15);
    } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [24, 24] });
    }
}

/* ==========================================================================
   Locate Map: Einzelner Marker nach GPS-Fix
   ========================================================================== */
function renderLocateMap(containerId, getMap, setMap, getMarker, setMarker, lat, lon) {
    const mapEl = document.getElementById(containerId);
    if (!mapEl) return;

    // Leaflet may be missing on pages loaded while offline before the first
    // online visit. The fetch result still renders; only the map is skipped.
    if (typeof L === 'undefined') {
        console.warn('Leaflet not loaded – locate map unavailable.');
        return;
    }

    if (!getMap()) {
        const map = L.map(containerId, { zoomControl: false });
        L.tileLayer(OSM_TILE_URL, { attribution: OSM_ATTRIBUTION, maxZoom: 19 }).addTo(map);
        setMap(map);
    }

    // Update or create marker
    if (getMarker()) {
        getMarker().setLatLng([lat, lon]);
    } else {
        setMarker(L.marker([lat, lon]).addTo(getMap()));
    }

    // Delay to let the container finish its CSS transition before sizing
    setTimeout(() => {
        getMap().invalidateSize();
        getMap().setView([lat, lon], 15);
    }, 50);
}

export function showLocateMap(lat, lon) {
    renderLocateMap('locate-map', getLocateMap, setLocateMap, getLocateMarker, setLocateMarker, lat, lon);
}

export function showLocateSavedMap(lat, lon) {
    renderLocateMap('locate-saved-map', getLocateSavedMap, setLocateSavedMap, getLocateSavedMarker, setLocateSavedMarker, lat, lon);
}

/* ==========================================================================
   Map Listener Init (Toggle-Buttons + Popup Share Delegation)
   Wird aus main.js via DOMContentLoaded aufgerufen.
   ========================================================================== */
export function initMapListeners() {
    const listBtn = document.getElementById('toggle-list-btn');
    const mapBtn  = document.getElementById('toggle-map-btn');
    if (listBtn) listBtn.addEventListener('click', () => setHistoryView('list'));
    if (mapBtn)  mapBtn.addEventListener('click',  () => setHistoryView('map'));

    // Event delegation für Share-Buttons in Leaflet-Popups.
    // Popup-DOM existiert erst nach Öffnen, daher Delegation vom stabilen Container.
    const historyMapEl = document.getElementById('history-map');
    if (historyMapEl) {
        historyMapEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.map-popup-share');
            if (!btn) return;

            const mapsUrl  = btn.getAttribute('data-maps-url');
            const address  = btn.getAttribute('data-address');

            if (navigator.share) {
                navigator.share({
                    title: 'locate.me',
                    text: address,
                    url: mapsUrl
                }).catch(err => {
                    console.log('Share cancelled or failed:', err.message);
                });
            } else {
                navigator.clipboard.writeText(mapsUrl).then(() => {
                    const originalHTML = btn.innerHTML;
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.innerHTML = originalHTML; }, 1500);
                }).catch(() => {});
            }
        });
    }
}