/* ==========================================================================
   Global Configuration: Dynamic API Environment Detection (DEV vs PROD)
   ========================================================================== */
const API_BASE_URL = window.location.port === '8080'
    ? 'http://localhost:8080'  // Local Quarkus Backend for local Live Server testing
    : '';                      // Production/Caddy-Proxy Environment (relative proxy paths)
const API_PATH = '/api';

/* ==========================================================================
   Date Formatting Utility
   ========================================================================== */
function formatRelativeDate(timestamp) {
    if (!timestamp) return 'Unknown Date';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return 'Unknown Date';

    const now = new Date();
    const todayStart     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    const timeStr = d.toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' });

    if (d >= todayStart) {
        return `Today, ${timeStr}`;
    } else if (d >= yesterdayStart) {
        return `Yesterday, ${timeStr}`;
    } else {
        return d.toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
}

/* ==========================================================================
   Backend Health & Status Indicator Logic
   ========================================================================== */
async function checkBackendStatus(showToast = false) {
    const statusDot = document.querySelector('.status-dot');
    if (!statusDot) return;

    try {
        // Enforce a strict timeout to avoid endless hangs on slow mobile networks
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(`${API_BASE_URL}${API_PATH}/system/info`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            statusDot.classList.remove('offline');
            statusDot.classList.add('online');
            statusDot.parentElement.title = "Application Online";
            if (showToast) showStatusToast('online');
            const info = await response.json();
            renderBackendInfo(info);
        } else {
            throw new Error("Backend answered with error status code");
        }
    } catch (error) {
        statusDot.classList.remove('online');
        statusDot.classList.add('offline');
        statusDot.parentElement.title = "Backend unreachable";
        if (showToast) showStatusToast('offline');
        renderBackendInfo(null);
    }
}

/* ==========================================================================
   Backend Info Renderer (Settings Page)
   ========================================================================== */
function renderBackendInfo(info) {
    const el = document.getElementById('backend-info');
    if (!el) return;

    if (!info) {
        el.innerHTML = `<span class="backend-info-label">BACKEND</span>
                        <span class="backend-info-value backend-info-offline">Not reachable</span>`;
        return;
    }

    let onlineSince = '–';
    if (info.startupTime) {
        const d = new Date(info.startupTime);
        if (!isNaN(d.getTime())) {
            onlineSince = d.toLocaleString('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }
    }

    el.innerHTML = `<span class="backend-info-label">BACKEND</span>
                    <span class="backend-info-value">${info.artifactId || '–'} ${info.version || ''}</span>
                    <span class="backend-info-since">Online since ${onlineSince}</span>`;
}

/* ==========================================================================
   Status Toast Notification
   ========================================================================== */
function showStatusToast(state) {
    // Remove any existing toast to avoid stacking
    const existing = document.getElementById('status-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'status-toast';
    toast.className = `status-toast status-toast--${state}`;
    toast.textContent = state === 'online' ? '✓ Backend online' : '✗ Backend not reachable';

    document.querySelector('.app-container').appendChild(toast);

    // Trigger reflow to enable CSS transition
    toast.getBoundingClientRect();
    toast.classList.add('status-toast--visible');

    const duration = state === 'online' ? 2000 : 3000;
    setTimeout(() => {
        toast.classList.remove('status-toast--visible');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}

/* ==========================================================================
   SPA Navigation Framework (Tab Controller)
   ========================================================================== */
document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        const targetPageId = button.getAttribute('data-target');
        document.querySelectorAll('.app-page').forEach(page => page.classList.add('hidden'));
        document.getElementById(targetPageId).classList.remove('hidden');

        if (targetPageId === 'page-history') {
            fetchAndRenderHistory();
        } else {
            // Leaving history page: reset to list view so next visit starts fresh
            setHistoryView('list');
        }
    });
});

/* ==========================================================================
   History View Toggle (List <-> Map)
   ========================================================================== */
let _historyMap = null;         // Leaflet map instance (lazy init)
let _historyMapData = [];       // Last fetched positions, shared with map renderer
let _currentHistoryView = 'list';

function setHistoryView(view) {
    _currentHistoryView = view;
    const listEl   = document.getElementById('history-list');
    const mapEl    = document.getElementById('history-map');
    const listBtn  = document.getElementById('toggle-list-btn');
    const mapBtn   = document.getElementById('toggle-map-btn');
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

function initOrRefreshMap() {
    const mapEl = document.getElementById('history-map');
    if (!mapEl) return;

    if (!_historyMap) {
        // First init: create Leaflet instance
        _historyMap = L.map('history-map', { zoomControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(_historyMap);
    }

    // invalidateSize fixes rendering in previously hidden containers
    setTimeout(() => {
        _historyMap.invalidateSize();
        renderMapMarkers();
    }, 50);
}

function renderMapMarkers() {
    if (!_historyMap) return;

    // Clear existing markers
    _historyMap.eachLayer(layer => {
        if (layer instanceof L.Marker) _historyMap.removeLayer(layer);
    });

    if (!_historyMapData || _historyMapData.length === 0) return;

    const bounds = [];

    _historyMapData.forEach((pos, index) => {
        if (!pos.latitude || !pos.longitude) return;

        const lat = parseFloat(pos.latitude);
        const lon = parseFloat(pos.longitude);
        if (isNaN(lat) || isNaN(lon)) return;

        const shortAddr = formatShortAddress(pos);
        const dateFormatted = formatRelativeDate(pos.timestamp);

        const marker = L.marker([lat, lon]).addTo(_historyMap);
        marker.bindPopup(
            `<div class="map-popup">` +
            `<span class="map-popup-index">#${index + 1}</span>` +
            `<span class="map-popup-address">${shortAddr}</span>` +
            `<span class="map-popup-date">${dateFormatted}</span>` +
            `</div>`,
            { maxWidth: 220 }
        );
        bounds.push([lat, lon]);
    });

    if (bounds.length === 1) {
        _historyMap.setView(bounds[0], 15);
    } else if (bounds.length > 1) {
        _historyMap.fitBounds(bounds, { padding: [24, 24] });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const listBtn = document.getElementById('toggle-list-btn');
    const mapBtn  = document.getElementById('toggle-map-btn');
    if (listBtn) listBtn.addEventListener('click', () => setHistoryView('list'));
    if (mapBtn)  mapBtn.addEventListener('click',  () => setHistoryView('map'));
});

/* ==========================================================================
   Global Helper: Dynamically extract active User ID from LocalStorage
   ========================================================================== */
function getActiveUserId() {
    const savedId = localStorage.getItem('userId');
    return (savedId && savedId.trim() !== "") ? savedId.trim() : "user123";
}

/* ==========================================================================
   Global Helper: History Badge State Controller
   ========================================================================== */
function updateHistoryBadge(count) {
    const badge = document.getElementById('history-badge');
    if (!badge) return;
    
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

/* ==========================================================================
   Global Helper: Background Silent Badge Sync (for initialization)
   ========================================================================== */
function silentBadgeSync() {
    fetch(`${API_BASE_URL}${API_PATH}/positions?userId=${encodeURIComponent(getActiveUserId())}`)
        .then(response => {
            if (response.ok) return response.json();
            throw new Error();
        })
        .then(data => {
            if (Array.isArray(data)) {
                updateHistoryBadge(data.length);
            }
        })
        .catch(() => {
            console.log("Silent badge sync paused. Offline or server unreachable.");
            checkBackendStatus(); // Trigger 4: Reactive switch on background sync failure
        });
}

/* ==========================================================================
   Global Helper: Pure, lightweight Inline SVG Location Icon Renderer
   ========================================================================== */
function getLocationIconSvg(category, type) {
    const svgAttrs = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"`;
    const defaultIcon = `<svg ${svgAttrs}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

    if (!category) return defaultIcon;

    switch (category) {
        case 'building':
            return `<svg ${svgAttrs}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;

        case 'highway':
        case 'railway':
            if (['bus_stop', 'platform', 'station'].includes(type)) {
                return `<svg ${svgAttrs}><rect x="6" y="3" width="12" height="16" rx="2"></rect><line x1="9" y1="19" x2="7" y2="22"></line><line x1="15" y1="19" x2="17" y2="22"></line><circle cx="9" cy="15" r="1"></circle><circle cx="15" cy="15" r="1"></circle><path d="M6 9h12"></path></svg>`;
            }
            return `<svg ${svgAttrs}><line x1="18" y1="21" x2="14" y2="3"></line><line x1="6" y1="21" x2="10" y2="3"></line><line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="3,3"></line></svg>`;

        case 'shop':
        case 'craft':
            return `<svg ${svgAttrs}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;

        case 'leisure':
        case 'landuse':
        case 'natural':
            return `<svg ${svgAttrs}><path d="M12 19V5M12 5a4 4 0 0 0-4 4c0 2.5 2.5 5 4 7m0-11a4 4 0 0 1 4 4c0 2.5-2.5 5-4 7m-3 3h6"></path></svg>`;

        case 'amenity':
            if (['restaurant', 'cafe', 'fast_food', 'bar'].includes(type)) {
                return `<svg ${svgAttrs}><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>`;
            }
            return `<svg ${svgAttrs}><path d="M3 21h18M3 10h18M3 7l9-4 9 4M7 10v7M12 10v7M17 10v7"></path></svg>`;

        case 'tourism':
        case 'historic':
            return `<svg ${svgAttrs}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

        case 'waterway':
            return `<svg ${svgAttrs}><path d="M12 22a7 7 0 0 0 7-7c0-4-7-13-7-13s-7 9-7 13a7 7 0 0 0 7 7z"></path></svg>`;

        default:
            return defaultIcon;
    }
}

/* ==========================================================================
   Global Helper: Semantic Address Formatter
   ========================================================================== */
function formatShortAddress(pos) {
    if (!pos) return "Unknown Location";
    let shortAddress = '';

    if (pos.osmName && pos.osmName.trim() !== '') {
        shortAddress = pos.osmName;
    } else if (pos.road && pos.houseNumber) {
        shortAddress = `${pos.road} ${pos.houseNumber}`;
    } else if (pos.road) {
        shortAddress = pos.road;
    } else {
        return pos.displayName || `Lat: ${pos.latitude.toFixed(4)}, Lon: ${pos.longitude.toFixed(4)}`;
    }

    if (pos.city) shortAddress += `, ${pos.city}`;
    if (pos.country) shortAddress += `, ${pos.country}`;

    return shortAddress;
}

/* ==========================================================================
   Global Helper: Pure, lightweight Inline SVG Weather Icon Renderer
   ========================================================================== */
function getWeatherIconSvg(code) {
    const svgAttrs = `class="embedded-weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    const fallbackIcon = `<svg ${svgAttrs}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

    if (code === undefined || code === null) return fallbackIcon;

    switch (true) {
        case (code === 0):
            return `<svg class="embedded-weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
        case (code >= 1 && code <= 3):
            return `<svg ${svgAttrs}><path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42-1.03-1.42-2.5-3.5-2.5a4.5 4.5 0 0 0-4.5 4.5c0 .14 0 .27.02.4A4 4 0 0 0 4 17a3.5 3.5 0 0 0 3.5 3.5h10z"></path></svg>`;
        case (code >= 45 && code <= 48):
            return `<svg ${svgAttrs}><line x1="5" y1="8" x2="19" y2="8"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="6" y1="16" x2="18" y2="16"></line></svg>`;
        case ((code >= 51 && code <= 55) || (code >= 61 && code <= 65) || (code >= 80 && code <= 82)):
            return `<svg ${svgAttrs}><line x1="16" y1="13" x2="16" y2="21"></line><line x1="8" y1="13" x2="8" y2="21"></line><line x1="12" y1="15" x2="12" y2="23"></line><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>`;
        case ((code >= 71 && code <= 75) || code === 77 || code === 85 || code === 86):
            return `<svg ${svgAttrs}><line x1="12" y1="2" x2="12" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line><line x1="4.93" y1="19.07" x2="19.07" y2="4.93"></line></svg>`;
        case (code === 95 || code === 96 || code === 99):
            return `<svg ${svgAttrs}><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 8.58"></path><polyline points="13 11 9 17 12 17 11 23 15 17 12 17 13 11"></polyline></svg>`;
        default:
            return fallbackIcon;
    }
}

/* ==========================================================================
   Locate Page: Cached GPS Position & UI Reset
   ========================================================================== */
let _cachedLocatePosition = null;
let _locateMap = null;          // Leaflet map instance for Locate page (lazy init)
let _locateMarker = null;       // Single marker on the Locate map

function resetLocatePage() {
    document.getElementById('btn-fetch-location').textContent = '\uD83D\uDCCD FETCH LOCATION';
    document.getElementById('track-btn').style.display = 'none';
    _cachedLocatePosition = null;
}

/* ==========================================================================
   Locate Page Map: Show single marker at given coordinates
   ========================================================================== */
function showLocateMap(lat, lon) {
    const mapEl = document.getElementById('locate-map');
    if (!mapEl) return;

    if (!_locateMap) {
        _locateMap = L.map('locate-map', { zoomControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(_locateMap);
    }

    // Update or create marker
    if (_locateMarker) {
        _locateMarker.setLatLng([lat, lon]);
    } else {
        _locateMarker = L.marker([lat, lon]).addTo(_locateMap);
    }

    // Delay to let the container finish its CSS transition before sizing
    setTimeout(() => {
        _locateMap.invalidateSize();
        _locateMap.setView([lat, lon], 15);
    }, 50);
}

/* ==========================================================================
   Page 1 – Step 1: Fetch Location (GPS + GET /api/positions/current)
   ========================================================================== */
document.getElementById('btn-fetch-location').addEventListener('click', () => {
    const statusText = document.getElementById('status');
    const responseCard = document.getElementById('response-card');

    statusText.innerText = "Searching for GPS signal...";
    statusText.className = "status-loading";
    responseCard.classList.add('hidden');

    document.getElementById('track-btn').style.display = 'none';
    _cachedLocatePosition = null;

    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser.");
        return;
    }

    let watchId = null;
    let bestPosition = null;

    const maxWaitTimer = setTimeout(() => {
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            if (bestPosition) {
                statusText.innerText = "Timeout reached. Fetching best available...";
                fetchCurrentPosition(bestPosition);
            } else {
                showError("GPS Timeout: No position found.");
            }
        }
    }, 10000);

    const geoOptions = {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 0
    };

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
                bestPosition = position;
                statusText.innerText = `Improving signal... (\u00B1${Math.round(position.coords.accuracy)}m)`;
            }
            if (position.coords.accuracy <= 15) {
                clearTimeout(maxWaitTimer);
                navigator.geolocation.clearWatch(watchId);
                fetchCurrentPosition(position);
            }
        },
        (error) => {
            clearTimeout(maxWaitTimer);
            if (watchId) navigator.geolocation.clearWatch(watchId);
            if (bestPosition) {
                fetchCurrentPosition(bestPosition);
            } else {
                showError(`GPS Error: ${error.message}`);
            }
        },
        geoOptions
    );
});

/* ==========================================================================
   GET /api/positions/current – Read-Only Preview Renderer
   ========================================================================== */
function fetchCurrentPosition(position) {
    const statusText = document.getElementById('status');
    const responseCard = document.getElementById('response-card');
    const fetchBtn = document.getElementById('btn-fetch-location');

    statusText.innerText = "Fetching location data...";
    statusText.className = "status-loading";

    const { latitude, longitude } = position.coords;
    const url = `${API_BASE_URL}${API_PATH}/positions/current?userId=${encodeURIComponent(getActiveUserId())}&lat=${latitude}&lon=${longitude}`;

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`Server returned status ${response.status}`);
            return response.json();
        })
        .then(data => {
            statusText.innerText = "Ready";
            statusText.className = "status-ready";

            const now = new Date();
            document.getElementById('res-time-span').innerText = now.toLocaleString('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            document.getElementById('res-temp').innerText =
                (data.temperature != null) ? `${parseFloat(data.temperature).toFixed(1)} \u00B0C` : '-';

            const iconContainer = document.getElementById('res-weather-icon-container');
            iconContainer.innerHTML = getWeatherIconSvg(data.weatherCode);
            const mainIconSvg = iconContainer.querySelector('svg');
            if (mainIconSvg) mainIconSvg.style.stroke = "#1a5f8c";

            document.getElementById('res-weather').innerText = getWeatherText(data.weatherCode);

            const addressContainer = document.getElementById('res-address-container');
            addressContainer.innerHTML = `
                ${getLocationIconSvg(data.osmCategory, data.osmType)}
                <span>${formatShortAddress(data)}</span>
            `;
            addressContainer.title = data.displayName || "No detailed address available.";

            responseCard.classList.remove('hidden');

            _cachedLocatePosition = position;
            fetchBtn.textContent = 'Refresh';
            document.getElementById('track-btn').style.display = 'block';
            statusText.innerText = "Preview: Position not yet saved.";
            statusText.className = "status-preview";

            showLocateMap(latitude, longitude);
            
            checkBackendStatus(); // Proactively ensure indicator syncs back on success
        })
        .catch(err => {
            showError(`Fetch Error: ${err.message}`);
            checkBackendStatus(); // Trigger 4: Reactive status switch on API error
        });
}

/* ==========================================================================
   Page 1 – Step 2: Send Location (POST – Fresh GPS Poll)
   ========================================================================== */
document.getElementById('track-btn').addEventListener('click', () => {
    if (!_cachedLocatePosition) {
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

    let watchId = null;
    let bestPosition = null;

    const maxWaitTimer = setTimeout(() => {
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            if (bestPosition) {
                statusText.innerText = "Timeout reached. Sending best available location...";
                sendPositionToBackend(bestPosition);
            } else {
                showError("GPS Timeout: No position found.");
            }
        }
    }, 10000);

    const geoOptions = {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 0
    };

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
                sendPositionToBackend(position);
            }
        },
        (error) => {
            clearTimeout(maxWaitTimer);
            if (watchId) navigator.geolocation.clearWatch(watchId);
            if (bestPosition) {
                sendPositionToBackend(bestPosition);
            } else {
                showError(`GPS Error: ${error.message}`);
            }
        },
        geoOptions
    );
});

/* ==========================================================================
   Asynchronous HTTP POST Engine for Position Export
   ========================================================================== */
function sendPositionToBackend(position) {
    const statusText = document.getElementById('status');
    const responseCard = document.getElementById('response-card');

    statusText.innerText = "Sending to backend...";

    const clientTimestamp = new Date();
    const payload = {
        userId: getActiveUserId(),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: clientTimestamp.toISOString()
    };

    fetch(`${API_BASE_URL}${API_PATH}/positions?userId=${encodeURIComponent(getActiveUserId())}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(response => {
            if (!response.ok) throw new Error(`Server returned status ${response.status}`);
            return response.json();
        })
        .then(data => {


            const localTimeFormatted = clientTimestamp.toLocaleString('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            document.getElementById('res-time-span').innerText = localTimeFormatted;

            if (data.temperature !== undefined && data.temperature !== null) {
                document.getElementById('res-temp').innerText = `${parseFloat(data.temperature).toFixed(1)} °C`;
            } else {
                document.getElementById('res-temp').innerText = "-";
            }

            const iconContainer = document.getElementById('res-weather-icon-container');
            iconContainer.innerHTML = getWeatherIconSvg(data.weatherCode);
            const mainIconSvg = iconContainer.querySelector('svg');
            if (mainIconSvg) mainIconSvg.style.stroke = "#1a5f8c";

            document.getElementById('res-weather').innerText = getWeatherText(data.weatherCode);

            const addressContainer = document.getElementById('res-address-container');
            addressContainer.innerHTML = `
                ${getLocationIconSvg(data.osmCategory, data.osmType)}
                <span>${formatShortAddress(data)}</span>
            `;
            addressContainer.title = data.displayName || "No detailed address available.";

            responseCard.classList.remove('hidden');

            document.getElementById('track-btn').style.display = 'none';
            document.getElementById('btn-fetch-location').textContent = 'FETCH LOCATION';
            _cachedLocatePosition = null;

            statusText.innerText = "Location successfully saved.";
            statusText.className = "status-success";

            showLocateMap(payload.latitude, payload.longitude);

            silentBadgeSync();
            checkBackendStatus(); // Proactively ensure indicator syncs back on success
        })
        .catch(err => {
            showError(`Backend Error: ${err.message}`);
            checkBackendStatus(); // Trigger 4: Reactive switch on network loss/timeout
        });
}

/* ==========================================================================
   Page 2: History Engine (Accordion Drawer Implementation)
   ========================================================================== */
function fetchAndRenderHistory() {
    const listContainer = document.getElementById('history-list');
    listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--text-muted); font-size:0.9rem; padding:20px 0;">Loading historical logs...</div>`;

    const activeUserId = getActiveUserId();

    const fetchWithCoords = (lat, lon) => {
        let url = `${API_BASE_URL}${API_PATH}/positions?userId=${encodeURIComponent(activeUserId)}`;
        if (lat !== null && lon !== null) {
            url += `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
        }
        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error("Could not fetch history");
                return response.json();
            })
            .then(data => {
                listContainer.innerHTML = "";

                if (!data || !Array.isArray(data) || data.length === 0) {
                    listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--text-muted); font-size:0.9rem; padding:20px 0;">No locations logged yet for user "${activeUserId}".</div>`;
                    updateHistoryBadge(0);
                    _historyMapData = [];
                    return;
                }

                updateHistoryBadge(data.length);

                // Store for map renderer
                _historyMapData = data;

                // If map view is active, re-render markers with fresh data
                if (_currentHistoryView === 'map') {
                    renderMapMarkers();
                }

                data.forEach((pos, index) => {
                    try {
                        if (!pos || pos.id === undefined) return;

                        const card = document.createElement('div');
                        card.className = 'log-card';
                        card.id = `log-card-${pos.id}`;

                        let tempClass = "temp-none";
                        let tempFormatted = "-";
                        let weatherIconSvg = getWeatherIconSvg(null);

                        if (pos.temperature !== undefined && pos.temperature !== null && !isNaN(parseFloat(pos.temperature))) {
                            const tempVal = parseFloat(pos.temperature);
                            tempFormatted = `${tempVal.toFixed(1)}°C`;

                            if (tempVal <= 0) tempClass = "temp-blue";
                            else if (tempVal <= 10) tempClass = "temp-lightblue";
                            else if (tempVal < 25) tempClass = "temp-orange";
                            else tempClass = "temp-red";

                            const wCode = (pos.weatherCode !== undefined && pos.weatherCode !== null) ? parseInt(pos.weatherCode, 10) : null;
                            weatherIconSvg = getWeatherIconSvg(wCode);
                        }

                        let distanceHtml = "";
                        if (pos.distance !== undefined && pos.distance !== null && !isNaN(parseFloat(pos.distance))) {
                            const distVal = parseFloat(pos.distance);
                            distanceHtml = `
                                <div class="log-card-distance" style="font-size: 0.78rem; font-weight: 600; color: var(--text-muted); display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                                    <svg class="action-icon" style="stroke: var(--text-muted); width: 12px; height: 12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
                                    </svg>
                                    <span>${distVal.toFixed(2)} km</span>
                                </div>
                            `;
                        }

                        let walkingTimeHtml = "";
                        if (pos.walkingTimeMinutes !== undefined && pos.walkingTimeMinutes !== null && !isNaN(parseFloat(pos.walkingTimeMinutes))) {
                            const walkingFormatted = formatWalkingTime(parseFloat(pos.walkingTimeMinutes));
                            walkingTimeHtml = `
                                <div class="log-card-walking" style="font-size: 0.78rem; font-weight: 600; color: var(--text-muted); display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                                    <svg class="action-icon" style="stroke: var(--text-muted); width: 12px; height: 12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12 6 12 12 16 14"></polyline>
                                    </svg>
                                    <span>${walkingFormatted}</span>
                                </div>
                            `;
                        }

                        const dateFormatted = formatRelativeDate(pos.timestamp);

                        const shortAddress = formatShortAddress(pos);
                        const locationIcon = getLocationIconSvg(pos.osmCategory, pos.osmType);
                        const fullAddressForTitle = pos.displayName || 'No detailed address available.';

                        const isLowAccuracy = pos.accuracy && parseFloat(pos.accuracy) > 30;
                        const badgeBgColor = isLowAccuracy ? '#fef3c7' : '#f1f5f9';
                        const badgeTextColor = isLowAccuracy ? '#b45309' : 'var(--text-muted)';
                        const roundedAccuracy = pos.accuracy ? Math.round(pos.accuracy) : '?';

                        card.innerHTML = `
                            <div class="log-card-clickable-area">
                                <div class="log-card-header">
                                    <div>
                                        <span class="log-card-id">#${index + 1}</span>
                                        <span style="margin-left: 6px;">${dateFormatted}</span>
                                    </div>
                                    <span class="log-card-accuracy-badge" style="background-color: ${badgeBgColor}; color: ${badgeTextColor};">
                                        <svg class="log-accuracy-icon" style="stroke: ${badgeTextColor};" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="12" cy="12" r="7"></circle>
                                            <line x1="12" y1="1" x2="12" y2="4"></line>
                                            <line x1="12" y1="20" x2="12" y2="23"></line>
                                            <line x1="1" y1="12" x2="4" y2="12"></line>
                                            <line x1="20" y1="12" x2="23" y2="12"></line>
                                        </svg>
                                        <span>±${roundedAccuracy}m</span>
                                    </span>
                                </div>
                                <div class="log-card-body">
                                    <div class="log-card-address address-container" title="${fullAddressForTitle}">
                                        ${locationIcon}
                                        <span>${shortAddress}</span>
                                    </div>
                                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0;">
                                        <div class="log-card-temp ${tempClass}">
                                            ${weatherIconSvg}
                                            <span>${tempFormatted}</span>
                                        </div>
                                        ${distanceHtml}
                                        ${walkingTimeHtml}
                                    </div>
                                </div>
                            </div>
                            <div class="log-card-action-tray">
                                <a href="https://www.google.com/maps/search/?api=1&query=${pos.latitude},${pos.longitude}" 
                                   target="_blank" 
                                   rel="noopener" 
                                   class="tray-action-btn btn-action-maps">
                                    <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                        <circle cx="12" cy="10" r="3"></circle>
                                    </svg>
                                    Maps
                                </a>

                                <button class="tray-action-btn btn-action-share" data-lat="${pos.latitude}" data-lon="${pos.longitude}" data-address="${shortAddress.replace(/"/g, '&quot;')}">
                                    <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="18" cy="5" r="3"></circle>
                                        <circle cx="6" cy="12" r="3"></circle>
                                        <circle cx="18" cy="19" r="3"></circle>
                                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                                    </svg>
                                    Share
                                </button>

                                <button class="tray-action-btn btn-action-delete" data-id="${pos.id}">
                                    <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                    Delete
                                </button>
                            </div>
                        `;

                        const clickableArea = card.querySelector('.log-card-clickable-area');
                        clickableArea.addEventListener('click', () => {
                            const isExpanded = card.classList.contains('expanded');
                            document.querySelectorAll('.log-card.expanded').forEach(c => {
                                if (c !== card) c.classList.remove('expanded');
                            });
                            card.classList.toggle('expanded', !isExpanded);
                        });

                        card.querySelector('.btn-action-maps').addEventListener('click', e => e.stopPropagation());

                        const shareBtn = card.querySelector('.btn-action-share');
                        shareBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const lat = shareBtn.getAttribute('data-lat');
                            const lon = shareBtn.getAttribute('data-lon');
                            const address = shareBtn.getAttribute('data-address');
                            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

                            if (navigator.share) {
                                navigator.share({
                                    title: 'locate.me',
                                    text: address,
                                    url: mapsUrl
                                }).catch(err => {
                                    // User cancelled or share failed silently – no alert needed
                                    console.log('Share cancelled or failed:', err.message);
                                });
                            } else {
                                // Fallback: copy Maps link to clipboard
                                navigator.clipboard.writeText(mapsUrl).then(() => {
                                    shareBtn.textContent = 'Copied!';
                                    setTimeout(() => {
                                        shareBtn.innerHTML = `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> Share`;
                                    }, 1500);
                                }).catch(() => {
                                    // Clipboard also unavailable – nothing to do
                                });
                            }
                        });

                        const deleteBtn = card.querySelector('.btn-action-delete');
                        deleteBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const targetId = deleteBtn.getAttribute('data-id');
                            if (!targetId) return;

                            fetch(`${API_BASE_URL}${API_PATH}/positions/${targetId}?userId=${encodeURIComponent(getActiveUserId())}`, { method: 'DELETE' })
                                .then(response => {
                                    if (!response.ok) throw new Error("Could not process record removal");

                                    card.classList.add('card-leave-animate');
                                    card.addEventListener('animationend', () => {
                                        card.remove();
                                        const remainingCards = listContainer.querySelectorAll('.log-card');
                                        remainingCards.forEach((remainingCard, i) => {
                                            const idSpan = remainingCard.querySelector('.log-card-id');
                                            if (idSpan) idSpan.textContent = `#${i + 1}`;
                                        });
                                        updateHistoryBadge(remainingCards.length);

                                        if (remainingCards.length === 0) {
                                            listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--text-muted); font-size:0.9rem; padding:20px 0;">No locations logged yet for user "${activeUserId}".</div>`;
                                        }
                                    });
                                    checkBackendStatus(); // Proactively sync indicator on success
                                })
                                .catch(err => {
                                    alert(`Error removing entry: ${err.message}`);
                                    checkBackendStatus(); // Trigger 4: Reactive switch on DELETE failure
                                });
                        });

                        listContainer.appendChild(card);
                    } catch (itemError) {
                        console.error("Skipped rendering corrupted log item:", pos, itemError);
                    }
                });
                checkBackendStatus(); // Proactively sync indicator on successful history rendering
            })
            .catch(err => {
                listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--text-error); font-size:0.9rem; padding:20px 0;">Error: ${err.message}</div>`;
                checkBackendStatus(); // Trigger 4: Reactive switch on history network crash
            });
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                fetchWithCoords(pos.coords.latitude, pos.coords.longitude);
            },
            (err) => {
                console.warn(`Geolocation Error (${err.code}): ${err.message}`);
                fetchWithCoords(null, null);
            },
            {
                enableHighAccuracy: false,
                timeout: 15000,
                maximumAge: 60000
            }
        );
    } else {
        fetchWithCoords(null, null);
    }
}

/* ==========================================================================
   Page 3: LocalStorage Settings Engine & Lifecycle Lifecycle Hooks
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    const savedId = localStorage.getItem('userId');
    if (savedId) {
        document.getElementById('username-input').value = savedId;
    }

    // Tap on status indicator: re-check backend and show toast
    const statusIndicator = document.querySelector('.header-status-indicator');
    if (statusIndicator) {
        statusIndicator.style.cursor = 'pointer';
        statusIndicator.addEventListener('click', () => checkBackendStatus(true));
    }

    // Trigger 1: Core Startup Sequence
    silentBadgeSync();
    checkBackendStatus();
});

// Trigger 3: Event-driven recovery when app moves back into foreground
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        checkBackendStatus();
    }
});

document.getElementById('save-settings-btn').addEventListener('click', () => {
    const inputVal = document.getElementById('username-input').value.trim();
    const statusDiv = document.getElementById('settings-status');

    localStorage.setItem('userId', inputVal);

    statusDiv.style.color = "#16a34a";
    statusDiv.innerText = "Settings saved successfully!";

    silentBadgeSync();

    setTimeout(() => {
        statusDiv.innerText = "";
    }, 3000);
});

/* ==========================================================================
   Page 3: User ID Masking / Toggle Visibility Logic
   ========================================================================== */
const togglePasswordBtn = document.getElementById('toggle-password-btn');
if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
        const usernameInput = document.getElementById('username-input');
        const eyeVisible = document.getElementById('eye-icon-visible');
        const eyeHidden = document.getElementById('eye-icon-hidden');
        
        if (!usernameInput) return;

        // Toggle the input element type
        if (usernameInput.type === 'password') {
            usernameInput.type = 'text';
            // Update icon visibility
            eyeVisible.classList.add('hidden');
            eyeHidden.classList.remove('hidden');
        } else {
            usernameInput.type = 'password';
            // Update icon visibility
            eyeVisible.classList.remove('hidden');
            eyeHidden.classList.add('hidden');
        }
    });
}

/* ==========================================================================
   Utilities
   ========================================================================== */
function formatWalkingTime(minutes) {
    const total = Math.round(minutes);
    if (total < 60) return `${total} min`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function showError(message) {
    const statusText = document.getElementById('status');
    statusText.innerText = message;
    statusText.className = "status-error";
}

function getWeatherText(code) {
    if (code === undefined || code === null) return "Unknown";

    switch (true) {
        case (code === 0): return "Clear sky";
        case (code >= 1 && code <= 3): return "Mainly clear";
        case (code >= 45 && code <= 48): return "Fog";
        case (code >= 51 && code <= 55): return "Drizzle";
        case (code === 56 || code === 57): return "Freezing drizzle";
        case (code >= 61 && code <= 65): return "Rain";
        case (code === 66 || code === 67): return "Freezing rain";
        case (code >= 71 && code <= 75): return "Snow fall";
        case (code === 77): return "Snow grains";
        case (code >= 80 && code <= 82): return "Rain showers";
        case (code === 85 || code === 86): return "Snow showers";
        case (code === 95): return "Thunderstorm";
        case (code === 96 || code === 99): return "Thunderstorm with hail";
        default: return "Unknown";
    }
}

/* ==========================================================================
   PWA Service Worker Registration
   ========================================================================== */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker successfully registered!', reg.scope))
            .catch(err => console.error('Service Worker Registration failed:', err));
    });
}