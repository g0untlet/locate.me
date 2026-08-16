import { apiGetCurrentPosition, apiPostPosition } from '../api.js';
import { getCachedLocatePosition, setCachedLocatePosition } from '../state.js';
import { showLocateMap } from '../ui/map.js';
import { showError } from '../ui/status.js';
import {
    getWeatherIconSvg,
    getWeatherText,
    formatElevation,
    getLocationIconSvg,
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
   Internal: Reset Locate Page to initial state
   ========================================================================== */
function resetLocatePage() {
    document.getElementById('btn-fetch-location').textContent = 'FETCH LOCATION';
    document.getElementById('track-btn').style.display = 'none';
    resetSaveOptions();
    setCachedLocatePosition(null);
}

/* ==========================================================================
   Internal: Render weather + address data into the response card
   Shared by fetchCurrentPosition and sendPositionToBackend.
   ========================================================================== */
function renderLocationCard(data) {
    const tagComment    = document.getElementById('res-tag-comment');
    const tagPill       = document.getElementById('res-tag-pill');
    const commentText   = document.getElementById('res-comment-text');
    const hasTag        = Boolean(data.tag);
    const hasComment    = data.comment && data.comment.trim() !== '';

    if (tagPill) {
        tagPill.textContent = data.tag || '';
        tagPill.classList.toggle('hidden', !hasTag);
    }
    if (commentText) commentText.textContent = hasComment ? data.comment : '';
    if (tagComment) tagComment.classList.toggle('hidden', !hasTag && !hasComment);

    document.getElementById('res-temp').innerText =
        (data.temperature != null) ? `${parseFloat(data.temperature).toFixed(1)} \u00B0C` : '-';

    const iconContainer = document.getElementById('res-weather-icon-container');
    iconContainer.innerHTML = getWeatherIconSvg(data.weatherCode);
    const mainIconSvg = iconContainer.querySelector('svg');
    if (mainIconSvg) mainIconSvg.style.stroke = "#1a5f8c";

    document.getElementById('res-weather').innerText = getWeatherText(data.weatherCode);

    document.getElementById('res-uv').innerText =
        (data.uvIndex != null) ? parseFloat(data.uvIndex).toFixed(1) : '-';

    document.getElementById('res-elevation').innerText = formatElevation(data.elevation) || '-';

    const addressContainer = document.getElementById('res-address-container');
    addressContainer.innerHTML = `
        ${getLocationIconSvg(data.osmCategory, data.osmType)}
        <span>${formatShortAddress(data)}</span>
    `;
    addressContainer.title = data.displayName || "No detailed address available.";

    document.getElementById('response-card').classList.remove('hidden');
}

/* ==========================================================================
   Step 1: GET /api/positions/current – Preview Renderer
   ========================================================================== */
function fetchCurrentPosition(position, { getActiveUserId, checkBackendStatus }) {
    const statusText = document.getElementById('status');
    const fetchBtn   = document.getElementById('btn-fetch-location');

    statusText.innerText = "Fetching location data...";
    statusText.className = "status-loading";

    const { latitude, longitude } = position.coords;

    apiGetCurrentPosition(getActiveUserId(), latitude, longitude)
        .then(data => {
            const timeLabel = new Date().toLocaleString('de-DE', {
                hour: '2-digit', minute: '2-digit'
            });

            renderLocationCard(data);

            setCachedLocatePosition({ ...data, accuracy: position.coords.accuracy });
            fetchBtn.textContent = 'Refresh';
            document.getElementById('track-btn').style.display = 'block';
            showSaveOptions();
            statusText.innerText = `Preview from ${timeLabel} \u2014 not yet saved.`;
            statusText.className = "status-preview";

            showLocateMap(latitude, longitude);
            checkBackendStatus();

            setFetchBusy(false);
        })
        .catch(err => {
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
            renderLocationCard(data);

            document.getElementById('track-btn').style.display = 'none';
            document.getElementById('btn-fetch-location').textContent = 'FETCH LOCATION';
            resetSaveOptions();
            setCachedLocatePosition(null);

            statusText.innerText = "Location successfully saved.";
            statusText.className = "status-success";

            showLocateMap(payload.latitude, payload.longitude);

            silentBadgeSync(getActiveUserId());
            checkBackendStatus();
        })
        .catch(err => {
            showError(`Backend Error: ${err.message}`);
            checkBackendStatus();
        });
}

/* ==========================================================================
   Page Init: Bindet alle Locate-Listener.
   deps = { getActiveUserId, checkBackendStatus, silentBadgeSync }
   ========================================================================== */
export function initLocatePage(deps) {

    initSaveOptions();

    // --- FETCH LOCATION Button ---
    document.getElementById('btn-fetch-location').addEventListener('click', () => {
        if (isFetching) return;
        setFetchBusy(true);

        const statusText  = document.getElementById('status');
        const responseCard = document.getElementById('response-card');

        statusText.innerText = "Searching for GPS signal...";
        statusText.className = "status-loading";
        responseCard.classList.add('hidden');
        document.getElementById('track-btn').style.display = 'none';
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
                    showError(`GPS Error: ${error.message}`);
                    setFetchBusy(false);
                }
            },
            GEO_OPTIONS
        );
    });

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

        sendPositionToBackend(payload, deps);
    });
}
