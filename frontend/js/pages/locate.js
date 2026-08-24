import { apiGetCurrentPosition, apiGetPlaces, apiPostPosition } from '../api.js';
import { getCachedLocatePosition, setCachedLocatePosition } from '../state.js';
import { showLocateMap, showLocateSavedMap } from '../ui/map.js';
import { showError } from '../ui/status.js';
import {
    getWeatherIconSvg,
    getWeatherText,
    formatElevation,
    formatDistanceMeters,
    getLocationIconSvg,
    getPlaceIconSvg,
    formatPlaceLabel,
    formatShortAddress
} from '../utils.js';

/* ==========================================================================
   GPS Tuning
   ========================================================================== */
// Per-fix ceiling: max milliseconds a single position fix may take before the
// browser reports TIMEOUT. Aligned with GPS_MAX_WAIT_MS so a cold fix is not
// pre-empted mid-budget. Sweet spot for both Android Chrome and iOS Safari.
const GPS_TIMEOUT_MS = 8000;
// Total listening budget: keep listening until a fix meets
// GPS_TARGET_ACCURACY_M, then give up and use the best fix received so far.
const GPS_MAX_WAIT_MS = 8000;
// Success gate: a fix as accurate as this (or better) is used immediately.
// 30m matches the app's own "good" accuracy band (history flags >30m as low).
const GPS_TARGET_ACCURACY_M = 30;

/* ==========================================================================
   Shared GPS Options
   ========================================================================== */
const GEO_OPTIONS = {
    enableHighAccuracy: true,
    timeout: GPS_TIMEOUT_MS,
    maximumAge: 5000
};

/* ==========================================================================
   Fetch Button Busy Guard: verhindert, dass "Fetch Location"/"Refresh"
   während GPS-Suche oder laufendem Backend-Request erneut geklickt wird.
   ========================================================================== */
let isFetching = false;

function setFetchBusy(busy) {
    isFetching = busy;
    const btn = document.getElementById('btn-fetch-location');
    if (btn) btn.disabled = busy;
}

/* ==========================================================================
   Predefined Tags – single-select vocabulary, must match backend PositionTag
   ========================================================================== */
const PREDEFINED_TAGS = ['HOME', 'WORK', 'PARKING', 'SHOPPING', 'EATING', 'LEISURE', 'FRIENDS', 'HEALTH'];

/* ==========================================================================
   Locate Page Selection State
   selectedPlace === null  -> the resolved address is the selected location
   selectedPlace === place -> a "Places around me" row is selected (label only)
   ========================================================================== */
let selectedPlace = null;

/* ==========================================================================
   Internal: Save Options (Tag + Comment) helpers
   ========================================================================== */
function getSaveOptionsElements() {
    return {
        block:    document.getElementById('save-options'),
        toggle:   document.getElementById('save-options-toggle'),
        chips:    document.getElementById('tag-chips'),
        comment:  document.getElementById('comment-input'),
        counter:  document.getElementById('comment-counter'),
        summary:  document.getElementById('save-options-summary')
    };
}

function getSelectedTag() {
    const { chips } = getSaveOptionsElements();
    const selected = chips ? chips.querySelector('.tag-chip--selected') : null;
    return selected ? selected.getAttribute('data-tag') : null;
}

function setSaveOptionsExpanded(expanded) {
    const { block, toggle } = getSaveOptionsElements();
    if (!block) return;
    block.classList.toggle('expanded', expanded);
    if (toggle) toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function updateSaveOptionsSummary() {
    const { comment, summary } = getSaveOptionsElements();
    if (!summary) return;
    const tag         = getSelectedTag();
    const commentText = comment ? comment.value.trim() : '';
    const parts = [];
    if (tag) parts.push(tag);
    if (commentText) parts.push(commentText);
    summary.textContent = parts.join(' \u00B7 ');
    summary.classList.toggle('hidden', parts.length === 0);
}

function resetSaveOptions() {
    const { block, chips, comment, counter } = getSaveOptionsElements();
    if (!block) return;
    block.classList.add('hidden');
    setSaveOptionsExpanded(false);
    if (chips) {
        chips.querySelectorAll('.tag-chip--selected').forEach(c => c.classList.remove('tag-chip--selected'));
    }
    if (comment) comment.value = '';
    if (counter) counter.textContent = '0/25';
    updateSaveOptionsSummary();
}

function showSaveOptions() {
    const { block } = getSaveOptionsElements();
    if (!block) return;
    setSaveOptionsExpanded(false);
    block.classList.remove('hidden');
    updateSaveOptionsSummary();
}

function initSaveOptions() {
    const { toggle, chips, comment, counter } = getSaveOptionsElements();
    if (!chips) return;

    PREDEFINED_TAGS.forEach(tag => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'tag-chip';
        chip.setAttribute('data-tag', tag);
        chip.textContent = tag;
        chips.appendChild(chip);
    });

    // Disclosure: expand / collapse the tag + comment fields
    if (toggle) {
        toggle.addEventListener('click', () => {
            const expanded = toggle.getAttribute('aria-expanded') === 'true';
            setSaveOptionsExpanded(!expanded);
        });
    }

    // Single-select: tapping an active chip deselects it
    chips.addEventListener('click', (e) => {
        const chip = e.target.closest('.tag-chip');
        if (!chip) return;
        const wasSelected = chip.classList.contains('tag-chip--selected');
        chips.querySelectorAll('.tag-chip--selected').forEach(c => c.classList.remove('tag-chip--selected'));
        if (!wasSelected) chip.classList.add('tag-chip--selected');
        updateSaveOptionsSummary();
    });

    if (comment && counter) {
        comment.addEventListener('input', () => {
            counter.textContent = `${comment.value.length}/25`;
            updateSaveOptionsSummary();
        });
    }
}

/* ==========================================================================
   Internal: View Switching (chooser <-> saver <-> saved)
   ========================================================================== */
function showView(view) {
    ['locate-chooser', 'locate-saver', 'locate-saved'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', id !== `locate-${view}`);
    });
}

function hideViews() {
    ['locate-chooser', 'locate-saver', 'locate-saved'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

/* ==========================================================================
   Internal: Render helpers
   ========================================================================== */
function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function fillWeather({ icon, temp, weather, uv }, data) {
    if (icon) {
        icon.innerHTML = getWeatherIconSvg(data.weatherCode);
        const mainIconSvg = icon.querySelector('svg');
        if (mainIconSvg) mainIconSvg.style.stroke = "#1a5f8c";
    }
    if (temp) {
        temp.innerText = (data.temperature != null) ? `${parseFloat(data.temperature).toFixed(1)} \u00B0C` : '-';
    }
    if (weather) weather.innerText = getWeatherText(data.weatherCode);
    if (uv) {
        uv.innerText = (data.uvIndex != null) ? parseFloat(data.uvIndex).toFixed(1) : '-';
    }
}

function fillAddress(container, data) {
    if (!container) return;
    container.innerHTML = `
        ${getLocationIconSvg(data.osmCategory, data.osmType)}
        <span>${formatShortAddress(data)}</span>
    `;
    container.title = data.displayName || "No detailed address available.";
}

function setElevation(el, data) {
    if (el) el.innerText = formatElevation(data.elevation) || '-';
}

function chooserWeatherIds() {
    return {
        icon:    document.getElementById('chooser-weather-icon-container'),
        temp:    document.getElementById('chooser-temp'),
        weather: document.getElementById('chooser-weather'),
        uv:      document.getElementById('chooser-uv')
    };
}

function saverWeatherIds() {
    return {
        icon:    document.getElementById('saver-weather-icon-container'),
        temp:    document.getElementById('saver-temp'),
        weather: document.getElementById('saver-weather'),
        uv:      document.getElementById('saver-uv')
    };
}

/* ==========================================================================
   Internal: Places around me (chooser list)
   ========================================================================== */
function renderPlacesList(places) {
    const card  = document.getElementById('places-card');
    const list  = document.getElementById('places-list');
    const count = document.getElementById('places-count');
    if (!card || !list) return;

    list.innerHTML = '';
    const top = Array.isArray(places) ? places : [];

    if (top.length === 0) {
        card.classList.add('hidden');
        return;
    }

    card.classList.remove('hidden');
    if (count) {
        count.textContent = `${top.length} place${top.length === 1 ? '' : 's'}`;
    }

    top.forEach(place => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'place-row';
        row.setAttribute('aria-pressed', 'false');
        row.innerHTML = `
            ${getPlaceIconSvg(place.primaryCategory)}
            <span class="place-row-name">${escapeHtml(place.name || place.formattedAddress || 'Unknown place')}</span>
            <span class="place-row-distance">${formatDistanceMeters(place.distance)}</span>
        `;
        row.addEventListener('click', () => selectPlace(place, row));
        list.appendChild(row);
    });
}

function selectPlace(place, row) {
    selectedPlace = place;

    document.querySelectorAll('.place-row').forEach(r => {
        const isActive = r === row;
        r.classList.toggle('place-row--selected', isActive);
        r.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    document.getElementById('res-address-select').classList.remove('locate-select-row--selected');

    const container = document.getElementById('chooser-address-container');
    if (container) {
        const label = formatPlaceLabel(place);
        container.innerHTML = `${getPlaceIconSvg(place.primaryCategory)}<span>${escapeHtml(label)}</span>`;
        container.title = place.formattedAddress || '';
    }
}

function selectResolvedAddress() {
    selectedPlace = null;

    document.querySelectorAll('.place-row').forEach(r => {
        r.classList.remove('place-row--selected');
        r.setAttribute('aria-pressed', 'false');
    });
    document.getElementById('res-address-select').classList.add('locate-select-row--selected');

    const cached = getCachedLocatePosition();
    if (cached) fillAddress(document.getElementById('chooser-address-container'), cached);
}

/* ==========================================================================
   Internal: Chooser renderer – fills weather, address and places after a
   successful preview fetch.
   ========================================================================== */
function renderChooser(data, places) {
    selectedPlace = null;

    fillWeather(chooserWeatherIds(), data);
    fillAddress(document.getElementById('chooser-address-container'), data);
    setElevation(document.getElementById('chooser-elevation'), data);

    const addressSelect = document.getElementById('res-address-select');
    if (addressSelect) addressSelect.classList.add('locate-select-row--selected');

    renderPlacesList(places);
}

/* ==========================================================================
   Internal: Saved view renderer – fills the read-only confirmation card with
   the persisted position (tag/comment shown read-only, plus weather,
   location and elevation).
   ========================================================================== */
function showSavedCard(data) {
    const strip   = document.getElementById('saved-tag-comment');
    const pill    = document.getElementById('saved-tag-pill');
    const comment = document.getElementById('saved-comment-text');

    if (strip) {
        const hasTag     = Boolean(data.tag);
        const hasComment = data.comment && data.comment.trim() !== '';
        if (pill) {
            pill.textContent = data.tag || '';
            pill.classList.toggle('hidden', !hasTag);
        }
        if (comment) comment.textContent = hasComment ? data.comment : '';
        strip.classList.toggle('hidden', !hasTag && !hasComment);
    }

    fillWeather({
        icon:    document.getElementById('saved-weather-icon-container'),
        temp:    document.getElementById('saved-temp'),
        weather: document.getElementById('saved-weather'),
        uv:      document.getElementById('saved-uv')
    }, data);
    fillAddress(document.getElementById('saved-location-container'), data);
    setElevation(document.getElementById('saved-elevation'), data);
}

/* ==========================================================================
   Offline-Banner – schlanker Hinweis bei fehlender Verbindung auf der
   Locate-Seite (analog zur History, dort für gecachte Daten).
   Eigene ID, damit keine Kollision mit dem History-Banner entsteht.
   ========================================================================== */
const OFFLINE_BANNER_ID = 'offline-banner-locate';
const OFFLINE_BANNER_TEXT = "Offline — you're offline. Preview unavailable.";

function ensureOfflineBanner() {
    if (document.getElementById(OFFLINE_BANNER_ID)) return;
    const page = document.getElementById('page-locate');
    if (!page) return;
    const banner = document.createElement('div');
    banner.id = OFFLINE_BANNER_ID;
    banner.className = 'offline-banner hidden';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 1l22 22"></path>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
            <line x1="12" y1="20" x2="12.01" y2="20"></line>
        </svg>
        <span>${OFFLINE_BANNER_TEXT}</span>`;
    page.insertBefore(banner, page.firstChild);
}

function setOfflineBanner(show) {
    const banner = document.getElementById(OFFLINE_BANNER_ID);
    if (banner) banner.classList.toggle('hidden', !show);
}

/* ==========================================================================
   Step 1: GET /api/positions/current + GET /api/places – Preview Renderer
   Fetches the enriched preview (weather/address) and the nearby places in
   parallel. A places failure degrades gracefully to the address-only chooser.
   ========================================================================== */
function fetchCurrentPosition(position, { getActiveUserId, checkBackendStatus }) {
    const statusText = document.getElementById('status');
    const fetchBtn   = document.getElementById('btn-fetch-location');

    statusText.innerText = "Fetching location data...";
    statusText.className = "status-loading";

    const { latitude, longitude } = position.coords;
    const userId = getActiveUserId();

    const placesPromise = apiGetPlaces(userId, latitude, longitude).catch(() => []);

    Promise.all([
        apiGetCurrentPosition(userId, latitude, longitude),
        placesPromise
    ])
    .then(([data, places]) => {
        const timeLabel = new Date().toLocaleString('de-DE', {
            hour: '2-digit', minute: '2-digit'
        });

        renderChooser(data, places);

        setCachedLocatePosition({ ...data, accuracy: position.coords.accuracy });
        fetchBtn.textContent = 'Refresh';
        showView('chooser');
        statusText.innerText = `Preview from ${timeLabel} \u2014 not yet saved.`;
        statusText.className = "status-preview";

        checkBackendStatus();
        setOfflineBanner(false);
        setFetchBusy(false);
    })
    .catch(err => {
        if (!navigator.onLine) {
            ensureOfflineBanner();
            setOfflineBanner(true);
        }
        showError(`Fetch Error: ${err.message}`);
        checkBackendStatus();
        setFetchBusy(false);
    });
}

/* ==========================================================================
   Step 2: POST /api/positions – Save the previously fetched location data
   The enriched preview data is sent back verbatim; the backend only persists it.
   ========================================================================== */
function sendPositionToBackend(payload, { getActiveUserId, checkBackendStatus, silentBadgeSync }) {
    const statusText = document.getElementById('status');
    statusText.innerText = "Sending to backend...";

    apiPostPosition(getActiveUserId(), payload)
        .then(data => {
            showSavedCard(data);
            hideViews();
            showView('saved');
            showLocateSavedMap(data.latitude, data.longitude);

            resetSaveOptions();
            setCachedLocatePosition(null);
            selectedPlace = null;
            document.getElementById('btn-fetch-location').textContent = 'Fetch Location';

            statusText.innerText = "Location successfully saved.";
            statusText.className = "status-success";

            silentBadgeSync(getActiveUserId());
            checkBackendStatus();
        })
        .catch(err => {
            showError(`Backend Error: ${err.message}`);
            checkBackendStatus();
        });
}

/* ==========================================================================
   Internal: When a place is selected, use it as the saved label only.
   The GPS coordinates (and with them weather/elevation/accuracy) stay untouched.
   ========================================================================== */
function applySelectedPlace(payload) {
    if (!selectedPlace) return;
    const place = selectedPlace;
    payload.osmName = formatPlaceLabel(place);
    if (place.formattedAddress) payload.displayName = place.formattedAddress;
    if (place.street) payload.road = place.street;
    if (place.houseNumber) payload.houseNumber = place.houseNumber;
    if (place.city) payload.city = place.city;
    if (place.country) payload.country = place.country;
}

/* ==========================================================================
   Internal: CONTINUE – switch to the saver view, pre-filled with the
   selected location (resolved address or chosen place).
   ========================================================================== */
function handleContinue() {
    const cached = getCachedLocatePosition();
    if (!cached) {
        showError("No position available. Please fetch first.");
        return;
    }

    fillWeather(saverWeatherIds(), cached);
    setElevation(document.getElementById('saver-elevation'), cached);

    const locationContainer = document.getElementById('saver-location-container');
    if (selectedPlace) {
        const place = selectedPlace;
        const label = formatPlaceLabel(place);
        locationContainer.innerHTML = `${getPlaceIconSvg(place.primaryCategory)}<span>${escapeHtml(label)}</span>`;
        locationContainer.title = place.formattedAddress || '';
    } else {
        fillAddress(locationContainer, cached);
    }

    showSaveOptions();
    showView('saver');
    showLocateMap(cached.latitude, cached.longitude);
}

/* ==========================================================================
   Page Init: Bindet alle Locate-Listener.
   deps = { getActiveUserId, checkBackendStatus, silentBadgeSync }
   ========================================================================== */
export function initLocatePage(deps) {

    initSaveOptions();

    // --- FETCH LOCATION / REFRESH Button ---
    document.getElementById('btn-fetch-location').addEventListener('click', () => {
        if (isFetching) return;
        setFetchBusy(true);

        const statusText = document.getElementById('status');

        statusText.innerText = "Searching for GPS signal...";
        statusText.className = "status-loading";
        hideViews();
        selectedPlace = null;
        setCachedLocatePosition(null);

        if (!navigator.geolocation) {
            showError("Geolocation is not supported by your browser.");
            setFetchBusy(false);
            return;
        }

        let watchId      = null;
        let bestPosition = null;

        const maxWaitTimer = setTimeout(() => {
            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
                if (bestPosition) {
                    statusText.innerText = "Timeout reached. Fetching best available...";
                    fetchCurrentPosition(bestPosition, deps);
                } else {
                    if (!navigator.onLine) {
                        ensureOfflineBanner();
                        setOfflineBanner(true);
                    }
                    showError("GPS Timeout: No position found.");
                    setFetchBusy(false);
                }
            }
        }, GPS_MAX_WAIT_MS);

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
                    bestPosition = position;
                    statusText.innerText = `Improving signal... (\u00B1${Math.round(position.coords.accuracy)}m)`;
                }
                if (position.coords.accuracy <= GPS_TARGET_ACCURACY_M) {
                    clearTimeout(maxWaitTimer);
                    navigator.geolocation.clearWatch(watchId);
                    fetchCurrentPosition(position, deps);
                }
            },
            (error) => {
                clearTimeout(maxWaitTimer);
                if (watchId) navigator.geolocation.clearWatch(watchId);
                if (bestPosition) {
                    fetchCurrentPosition(bestPosition, deps);
                } else {
                    if (!navigator.onLine) {
                        ensureOfflineBanner();
                        setOfflineBanner(true);
                    }
                    showError(`GPS Error: ${error.message}`);
                    setFetchBusy(false);
                }
            },
            GEO_OPTIONS
        );
    });

    // --- Chooser: select resolved address ---
    document.getElementById('res-address-select').addEventListener('click', selectResolvedAddress);

    // --- Chooser: CONTINUE to saver view ---
    document.getElementById('btn-locate-continue').addEventListener('click', handleContinue);

    // --- SAVE LOCATION Button ---
    document.getElementById('track-btn').addEventListener('click', () => {
        const cached = getCachedLocatePosition();
        if (!cached) {
            showError("No position available. Please fetch first.");
            return;
        }

        const statusText = document.getElementById('status');
        statusText.innerText = "Saving location...";
        statusText.className = "status-loading";

        const payload = {
            ...cached,
            userId:    deps.getActiveUserId(),
            timestamp: new Date().toISOString()
        };

        const tag = getSelectedTag();
        if (tag) {
            payload.tag = tag;
        } else {
            delete payload.tag;
        }

        const comment = getSaveOptionsElements().comment ? getSaveOptionsElements().comment.value.trim() : '';
        if (comment) {
            payload.comment = comment;
        } else {
            delete payload.comment;
        }

        applySelectedPlace(payload);

        sendPositionToBackend(payload, deps);
    });
}
