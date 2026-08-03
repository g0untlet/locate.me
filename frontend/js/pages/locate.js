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
   Shared GPS Options
   ========================================================================== */
const GEO_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 9000,
    maximumAge: 0
};

/* ==========================================================================
   Internal: Reset Locate Page to initial state
   ========================================================================== */
function resetLocatePage() {
    document.getElementById('btn-fetch-location').textContent = 'FETCH LOCATION';
    document.getElementById('track-btn').style.display = 'none';
    setCachedLocatePosition(null);
}

/* ==========================================================================
   Internal: Render weather + address data into the response card
   Shared by fetchCurrentPosition and sendPositionToBackend.
   ========================================================================== */
function renderLocationCard(data, timeLabel) {
    document.getElementById('res-time-span').innerText = timeLabel;

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
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            renderLocationCard(data, timeLabel);

            setCachedLocatePosition(position);
            fetchBtn.textContent = 'Refresh';
            document.getElementById('track-btn').style.display = 'block';
            statusText.innerText = "Preview: Position not yet saved.";
            statusText.className = "status-preview";

            showLocateMap(latitude, longitude);
            checkBackendStatus();
        })
        .catch(err => {
            showError(`Fetch Error: ${err.message}`);
            checkBackendStatus();
        });
}

/* ==========================================================================
   Step 2: POST /api/positions – Save Location
   ========================================================================== */
function sendPositionToBackend(position, { getActiveUserId, checkBackendStatus, silentBadgeSync }) {
    const statusText = document.getElementById('status');
    statusText.innerText = "Sending to backend...";

    const clientTimestamp = new Date();
    const payload = {
        userId:    getActiveUserId(),
        latitude:  position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy:  position.coords.accuracy,
        timestamp: clientTimestamp.toISOString()
    };

    apiPostPosition(getActiveUserId(), payload)
        .then(data => {
            const timeLabel = clientTimestamp.toLocaleString('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            renderLocationCard(data, timeLabel);

            document.getElementById('track-btn').style.display = 'none';
            document.getElementById('btn-fetch-location').textContent = 'FETCH LOCATION';
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

    // --- FETCH LOCATION Button ---
    document.getElementById('btn-fetch-location').addEventListener('click', () => {
        const statusText  = document.getElementById('status');
        const responseCard = document.getElementById('response-card');

        statusText.innerText = "Searching for GPS signal...";
        statusText.className = "status-loading";
        responseCard.classList.add('hidden');
        document.getElementById('track-btn').style.display = 'none';
        setCachedLocatePosition(null);

        if (!navigator.geolocation) {
            showError("Geolocation is not supported by your browser.");
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
                }
            }
        }, 10000);

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
                    bestPosition = position;
                    statusText.innerText = `Improving signal... (\u00B1${Math.round(position.coords.accuracy)}m)`;
                }
                if (position.coords.accuracy <= 15) {
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
                }
            },
            GEO_OPTIONS
        );
    });

    // --- SAVE LOCATION Button ---
    document.getElementById('track-btn').addEventListener('click', () => {
        if (!getCachedLocatePosition()) {
            showError("No position available. Please fetch first.");
            return;
        }

        const statusText = document.getElementById('status');
        statusText.innerText = "Searching for precise GPS...";
        statusText.className = "status-loading";

        if (!navigator.geolocation) {
            showError("Geolocation is not supported by your browser.");
            return;
        }

        let watchId      = null;
        let bestPosition = null;

        const maxWaitTimer = setTimeout(() => {
            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
                if (bestPosition) {
                    statusText.innerText = "Timeout reached. Sending best available location...";
                    sendPositionToBackend(bestPosition, deps);
                } else {
                    showError("GPS Timeout: No position found.");
                }
            }
        }, 10000);

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
                    bestPosition = position;
                    statusText.innerText = `Improving signal... (\u00B1${Math.round(position.coords.accuracy)}m)`;
                }
                if (position.coords.accuracy <= 15) {
                    clearTimeout(maxWaitTimer);
                    navigator.geolocation.clearWatch(watchId);
                    statusText.innerText = "Precise location locked! Sending...";
                    sendPositionToBackend(position, deps);
                }
            },
            (error) => {
                clearTimeout(maxWaitTimer);
                if (watchId) navigator.geolocation.clearWatch(watchId);
                if (bestPosition) {
                    sendPositionToBackend(bestPosition, deps);
                } else {
                    showError(`GPS Error: ${error.message}`);
                }
            },
            GEO_OPTIONS
        );
    });
}