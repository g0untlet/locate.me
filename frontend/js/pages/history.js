import { apiGetPositions, apiDeletePosition } from '../api.js';
import { setHistoryMapData, getCurrentHistoryView } from '../state.js';
import { renderMapMarkers } from '../ui/map.js';
import { updateHistoryBadge } from '../ui/badge.js';
import {
    getWeatherIconSvg,
    getLocationIconSvg,
    formatShortAddress,
    formatRelativeDate,
    formatWalkingTime
} from '../utils.js';

/* ==========================================================================
   Internal: Share-Button Logik (List-View Action-Tray)
   ========================================================================== */
function handleShare(lat, lon, address) {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

    if (navigator.share) {
        navigator.share({
            title: 'locate.me',
            text: address,
            url: mapsUrl
        }).catch(err => {
            console.log('Share cancelled or failed:', err.message);
        });
    } else {
        navigator.clipboard.writeText(mapsUrl).catch(() => {});
    }
}

/* ==========================================================================
   Internal: Einzelne Log-Card bauen + Listener binden
   ========================================================================== */
function buildHistoryCard(pos, index, activeUserId, listContainer, { checkBackendStatus }) {
    const card = document.createElement('div');
    card.className = 'log-card';
    card.id = `log-card-${pos.id}`;

    // --- Temperatur & Wetter ---
    let tempClass      = "temp-none";
    let tempFormatted  = "-";
    let weatherIconSvg = getWeatherIconSvg(null);

    if (pos.temperature !== undefined && pos.temperature !== null && !isNaN(parseFloat(pos.temperature))) {
        const tempVal = parseFloat(pos.temperature);
        tempFormatted = `${tempVal.toFixed(1)}°C`;

        if (tempVal <= 0)       tempClass = "temp-blue";
        else if (tempVal <= 10) tempClass = "temp-lightblue";
        else if (tempVal < 25)  tempClass = "temp-orange";
        else                    tempClass = "temp-red";

        const wCode = (pos.weatherCode !== undefined && pos.weatherCode !== null)
            ? parseInt(pos.weatherCode, 10) : null;
        weatherIconSvg = getWeatherIconSvg(wCode);
    }

    // --- Distanz ---
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

    // --- Walking Time ---
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

    const dateFormatted      = formatRelativeDate(pos.timestamp);
    const shortAddress       = formatShortAddress(pos);
    const locationIcon       = getLocationIconSvg(pos.osmCategory, pos.osmType);
    const fullAddressForTitle = pos.displayName || 'No detailed address available.';

    const isLowAccuracy    = pos.accuracy && parseFloat(pos.accuracy) > 30;
    const badgeBgColor     = isLowAccuracy ? '#fef3c7' : '#f1f5f9';
    const badgeTextColor   = isLowAccuracy ? '#b45309' : 'var(--text-muted)';
    const roundedAccuracy  = pos.accuracy ? Math.round(pos.accuracy) : '?';

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
            <button class="tray-action-btn btn-action-share"
                    data-lat="${pos.latitude}"
                    data-lon="${pos.longitude}"
                    data-address="${shortAddress.replace(/"/g, '&quot;')}">
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

    // --- Accordion Toggle ---
    card.querySelector('.log-card-clickable-area').addEventListener('click', () => {
        const isExpanded = card.classList.contains('expanded');
        document.querySelectorAll('.log-card.expanded').forEach(c => {
            if (c !== card) c.classList.remove('expanded');
        });
        card.classList.toggle('expanded', !isExpanded);
    });

    // --- Maps Link: stopPropagation ---
    card.querySelector('.btn-action-maps').addEventListener('click', e => e.stopPropagation());

    // --- Share Button ---
    const shareBtn = card.querySelector('.btn-action-share');
    shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const lat     = shareBtn.getAttribute('data-lat');
        const lon     = shareBtn.getAttribute('data-lon');
        const address = shareBtn.getAttribute('data-address');

        if (navigator.share) {
            handleShare(lat, lon, address);
        } else {
            navigator.clipboard.writeText(
                `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
            ).then(() => {
                shareBtn.textContent = 'Copied!';
                setTimeout(() => {
                    shareBtn.innerHTML = `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> Share`;
                }, 1500);
            }).catch(() => {});
        }
    });

    // --- Delete Button ---
    const deleteBtn = card.querySelector('.btn-action-delete');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = deleteBtn.getAttribute('data-id');
        if (!targetId) return;

        apiDeletePosition(activeUserId, targetId)
            .then(() => {
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
                checkBackendStatus();
            })
            .catch(err => {
                alert(`Error removing entry: ${err.message}`);
                checkBackendStatus();
            });
    });

    return card;
}

/* ==========================================================================
   fetchAndRenderHistory – Haupt-Einstiegspunkt, wird beim Tab-Wechsel aufgerufen
   deps = { getActiveUserId, checkBackendStatus }
   ========================================================================== */
export function fetchAndRenderHistory(deps) {
    const { getActiveUserId, checkBackendStatus } = deps;
    const listContainer = document.getElementById('history-list');
    listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--text-muted); font-size:0.9rem; padding:20px 0;">Loading historical logs...</div>`;

    const activeUserId = getActiveUserId();

    const fetchWithCoords = (lat, lon) => {
        apiGetPositions(activeUserId, lat, lon)
            .then(data => {
                listContainer.innerHTML = "";

                if (!data || !Array.isArray(data) || data.length === 0) {
                    listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--text-muted); font-size:0.9rem; padding:20px 0;">No locations logged yet for user "${activeUserId}".</div>`;
                    updateHistoryBadge(0);
                    setHistoryMapData([]);
                    return;
                }

                updateHistoryBadge(data.length);
                setHistoryMapData(data);

                if (getCurrentHistoryView() === 'map') {
                    renderMapMarkers();
                }

                data.forEach((pos, index) => {
                    try {
                        if (!pos || pos.id === undefined) return;
                        const card = buildHistoryCard(pos, index, activeUserId, listContainer, { checkBackendStatus });
                        listContainer.appendChild(card);
                    } catch (itemError) {
                        console.error("Skipped rendering corrupted log item:", pos, itemError);
                    }
                });

                checkBackendStatus();
            })
            .catch(err => {
                listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--error-color, #dc2626); font-size:0.9rem; padding:20px 0;">Error: ${err.message}</div>`;
                checkBackendStatus();
            });
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => fetchWithCoords(pos.coords.latitude, pos.coords.longitude),
            (err) => {
                console.warn(`Geolocation Error (${err.code}): ${err.message}`);
                fetchWithCoords(null, null);
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
    } else {
        fetchWithCoords(null, null);
    }
}