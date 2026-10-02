import { apiGetPositionsWithMeta, apiDeletePosition } from '../api.js';
import { setHistoryMapData, getCurrentHistoryView, getHistoryFilter, setHistoryFilter } from '../state.js';
import { t } from '../i18n.js';
import { renderMapMarkers } from '../ui/map.js';
import { updateHistoryBadge } from '../ui/badge.js';
import { subscribeHeading, getHeading, requestHeadingPermission } from '../ui/compass.js';
import {
    getWeatherIconSvg,
    getUvLevel,
    getLocationIconSvg,
    getTravelIconSvg,
    bearingDegrees,
    compassPoint,
    directionShort,
    directionName,
    arrowRotation,
    shortestPathRotation,
    distanceMeters,
    formatShortAddress,
    formatRelativeDate,
    formatTravelTime,
    formatElevation,
    PREDEFINED_TAGS,
    posMatchesFilter
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
   Live Direction Arrows (heading-relative)

   Each card's arrow is rotated to where the entry lies RELATIVE TO WHERE THE
   PHONE IS POINTING: rotation = bearing + heading, with `heading` being the
   needle screen angle from the shared sensor source (js/ui/compass.js). This is
   the same feel as the Locate-page needle: turn the phone and the arrows sweep.
   (bearing alone is the true compass direction, shown as the letter.)

   Two independent inputs feed the arrows:
   - heading  (js/ui/compass.js)  -> changes `rotation` on every sensor event
   - origin   (gated GPS watcher) -> changes `bearing` when the user moved

   Battery notes:
   - The heading callback does no work while this page is hidden (the rotation
     pass is gated on the DOM visibility of #page-history), and the GPS watcher
     is stopped entirely on tab switch and on visibilitychange.
   - The GPS watcher only runs while the History tab is visible and rejects
     fixes that are inaccurate or do not represent real movement, so standing
     still never wakes the radio more than once.
   - Accepted fixes recompute the arrows LOCALLY from the data already loaded
     into this page - no backend request, no re-render.
   - Writes are coalesced into one requestAnimationFrame and skipped below a
     1 degree deadband, so a steady phone produces no DOM writes at all.
   ========================================================================== */

/* Gate for the GPS watcher: ignore fixes that are too fuzzy or too close to the
   origin we already used. Chosen so normal walking still refreshes the bearing
   (the letter/direction) without jittering while standing still. */
const LIVE_MIN_MOVE_M = 5;
const LIVE_MAX_ACCURACY_M = 100;
const LIVE_WATCH_OPTIONS = { enableHighAccuracy: false, maximumAge: 5000, timeout: 30000 };

/* Deadband for arrow rotations: below 1 degree the change is invisible, and
   skipping it keeps a still phone at zero style writes. */
const ARROW_DEADBAND_DEG = 1;

/* Within this radius the 8-point compass letter is meaningless and the arrow is
   dominated by GPS jitter, so the direction badge is hidden. Re-evaluated live
   from the movement-gated fix, so it appears again once the user walks away. */
const DIRECTION_MIN_DISTANCE_M = 50;

/* One record per rendered arrow. `rotation` is the accumulated (unwrapped)
   angle fed to the CSS transition, `bearing` the north-referenced direction. */
let directionArrows = [];
let headingUnsubscribe = null;
let liveWatchId = null;
let liveOrigin = null;
let arrowFrame = 0;
let visibilityHooked = false;
let liveInitialized = false;

/* The page's own visibility is read straight from the DOM instead of from a
   flag set by app.js: a missed or reordered lifecycle call then cannot freeze
   the arrows. */
function isHistoryPageVisible() {
    const page = document.getElementById('page-history');
    return !!page && !page.classList.contains('hidden');
}

/* rAF-coalesced write pass. Both the heading stream (fast) and the GPS gate
   (rare) end up here, so at most one style pass per animation frame happens. */
function scheduleArrowUpdate() {
    if (arrowFrame) return;
    arrowFrame = requestAnimationFrame(() => {
        arrowFrame = 0;
        applyArrowRotations();
    });
}

function applyArrowRotations() {
    // Hidden page: the elements still exist in the DOM, so without this guard a
    // 60 Hz sensor stream would keep writing transforms nobody can see.
    if (!isHistoryPageVisible() || directionArrows.length === 0) return;
    const heading = getHeading();

    for (const record of directionArrows) {
        if (record.hidden) continue;
        const target = arrowRotation(record.bearing, heading);
        if (isNaN(target)) continue;
        const next = shortestPathRotation(record.rotation, target);
        // Skip invisible changes, but always paint the very first value.
        if (record.rotation !== null && Math.abs(next - record.rotation) < ARROW_DEADBAND_DEG) continue;
        record.rotation = next;
        record.el.style.transform = `rotate(${next.toFixed(1)}deg)`;
    }
}

/* Registers the arrow of a freshly rendered card. `pos` is the stored entry,
   `bearing` the direction from the origin the card was rendered with.
   Deliberately O(1): the list render calls this once per card, so sweeping all
   arrows here would be quadratic on a long history. */
function registerDirectionArrow(card, pos, bearing) {
    const arrow = card.querySelector('.log-direction-arrow');
    if (!arrow || isNaN(bearing)) return;

    // A freshly created element has no computed transform yet, so this first
    // write cannot animate - no transition juggling needed.
    const rotation = shortestPathRotation(null, arrowRotation(bearing, getHeading()));
    arrow.style.transform = `rotate(${rotation.toFixed(1)}deg)`;
    const badge = arrow.closest('.log-card-direction');
    directionArrows.push({
        el: arrow,
        bearing,
        rotation,
        latitude: pos.latitude,
        longitude: pos.longitude,
        hidden: !!(badge && badge.classList.contains('hidden'))
    });
}

/* Drops the arrow references of a previous render (the list is about to be
   replaced). Deliberately does NOT touch the GPS watcher: the watcher's
   lifecycle belongs to onHistoryPageShown/onHistoryPageHidden, and pull-to-refresh
   re-renders while the watcher must keep running. */
function clearDirectionArrows() {
    directionArrows = [];
}

/* A new origin: recompute every bearing locally. The letters stay absolute but
   must still match the arrow, so they are re-derived here as well. The badge is
   hidden while the entry is within DIRECTION_MIN_DISTANCE_M and shown again once
   the user walks away, all from the same local fix (no backend request). */
function applyOrigin(latitude, longitude) {
    liveOrigin = { latitude, longitude };

    for (const record of directionArrows) {
        const bearing = bearingDegrees(latitude, longitude, record.latitude, record.longitude);
        if (isNaN(bearing)) continue;
        record.bearing = bearing;

        const badge = record.el.closest('.log-card-direction');
        if (!badge) continue;

        const distM = distanceMeters(latitude, longitude, record.latitude, record.longitude);
        record.hidden = !isNaN(distM) && distM < DIRECTION_MIN_DISTANCE_M;
        badge.classList.toggle('hidden', record.hidden);

        const compass = compassPoint(bearing);
        const label = compass ? t('history.directionTitle', { direction: directionName(compass) }) : '';
        const letters = badge.querySelector('span');
        if (letters) letters.textContent = directionShort(compass);
        if (label) {
            badge.setAttribute('title', label);
            badge.setAttribute('aria-label', label);
        }
    }
    scheduleArrowUpdate();
}

function shouldAcceptFix(latitude, longitude, accuracy) {
    if (typeof accuracy === 'number' && accuracy > LIVE_MAX_ACCURACY_M) return false;
    if (!liveOrigin) return true;
    return distanceMeters(liveOrigin.latitude, liveOrigin.longitude, latitude, longitude) >= LIVE_MIN_MOVE_M;
}

function onLiveFix(pos) {
    const { latitude, longitude, accuracy } = pos.coords;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
    if (!shouldAcceptFix(latitude, longitude, accuracy)) return;
    applyOrigin(latitude, longitude);
}

function startLiveWatch() {
    const list = document.getElementById('history-list');
    if (list) list.classList.add('is-live-directions');
    if (liveWatchId !== null || !navigator.geolocation) return;
    try {
        liveWatchId = navigator.geolocation.watchPosition(onLiveFix, () => {}, LIVE_WATCH_OPTIONS);
    } catch {
        liveWatchId = null;
    }
}

/* The is-live-directions class only exists while this page is the active,
   visible view — it gates `will-change: transform`, so it must be released
   together with the watcher (also on the early return, e.g. when geolocation
   is unavailable and no watch was ever started). */
function stopLiveWatch() {
    const list = document.getElementById('history-list');
    if (list) list.classList.remove('is-live-directions');
    if (liveWatchId === null) return;
    navigator.geolocation.clearWatch(liveWatchId);
    liveWatchId = null;
}

/* Hooked once: backgrounding the app must release the GPS radio, resuming must
   restore it (only while the History tab is the visible one). */
function hookVisibility() {
    if (visibilityHooked) return;
    visibilityHooked = true;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopLiveWatch();
        } else if (isHistoryPageVisible()) {
            startLiveWatch();
        }
    });
}

/* The heading subscription is created once and kept for the app lifetime: the
   callback is a no-op while the History page is hidden (see applyArrowRotations),
   so returning to the tab is instant. */
function ensureHeadingSubscription() {
    if (!headingUnsubscribe) headingUnsubscribe = subscribeHeading(scheduleArrowUpdate);
}

/* Re-aim the arrows at the current heading, e.g. after returning to the tab. A
   frame scheduled before the tab was frozen can never fire while rAF is
   suspended, so drop it instead of letting it block all later updates. */
function catchUpArrows() {
    if (arrowFrame) {
        cancelAnimationFrame(arrowFrame);
        arrowFrame = 0;
    }
    scheduleArrowUpdate();
}

/* Called from app.js (and by our own nav hook) when the History tab is active. */
export function onHistoryPageShown() {
    hookVisibility();
    ensureHeadingSubscription();
    catchUpArrows();
    startLiveWatch();
}

export function onHistoryPageHidden() {
    stopLiveWatch();
}

/* Self-contained wiring: the History feature must not depend on app.js calling
   onHistoryPageShown() for it to work. Subscribe to the shared heading source at
   init and mirror the nav click to start/stop the GPS watcher. Everything here is
   idempotent with app.js's own lifecycle calls. */
function initHistoryLive() {
    if (liveInitialized) return;
    liveInitialized = true;
    hookVisibility();
    ensureHeadingSubscription();
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.getAttribute('data-target') === 'page-history') {
                // iOS: die Bewegungssensor-Permission muss synchron in der
                // User-Geste angefragt werden (No-op sonst; doppelte Anfragen
                // fängt compass.js ab).
                requestHeadingPermission();
                onHistoryPageShown();
            } else {
                onHistoryPageHidden();
            }
        });
    });
    if (isHistoryPageVisible()) {
        catchUpArrows();
        startLiveWatch();
    }
}

/* ==========================================================================
   Internal: Einzelne Log-Card bauen + Listener binden
   deps = { checkBackendStatus, origin } – origin = { latitude, longitude } of
   the current GPS fix (null without one) and basis for the direction badge.
   ========================================================================== */
function buildHistoryCard(pos, index, activeUserId, listContainer, { checkBackendStatus, origin }) {
    const card = document.createElement('div');
    card.className = 'log-card';
    card.id = `log-card-${pos.id}`;
    // Daten am Card-Element halten – Filter liest direkt vom Card, nicht aus
    // einem parallelen Array (Index-Drift nach Refresh/Delete vermeiden)
    card._pos = pos;

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

    // --- UV-Index ---
    let uvHtml = "";
    if (pos.uvIndex !== undefined && pos.uvIndex !== null && !isNaN(parseFloat(pos.uvIndex))) {
        const uvVal   = parseFloat(pos.uvIndex);
        const uvLevel = getUvLevel(uvVal);
        uvHtml = `
            <div class="uv-display uv-${uvLevel}" title="${t('history.uvTitle', { value: uvVal.toFixed(1) })}">
                <span>UV</span>
                <span>${uvVal.toFixed(1)}</span>
            </div>
        `;
    }

    // --- Distanz ---
    let distanceHtml = "";
    if (pos.distance !== undefined && pos.distance !== null && !isNaN(parseFloat(pos.distance))) {
        const distVal = parseFloat(pos.distance);
        const compactDistance = distVal > 100;
        distanceHtml = `
            <div class="log-card-distance" style="font-size: 0.78rem; font-weight: 600; color: var(--text-muted); background-color: #f1f5f9; padding: 2px 7px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                <svg class="action-icon" style="stroke: var(--text-muted); width: 12px; height: 12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
                </svg>
                <span>${compactDistance ? `~${Math.round(distVal)}` : distVal.toFixed(2)} km</span>
            </div>
        `;
    }

    // --- Travel Times (walk / bike / drive) ---
    const travelModes = [
        { mode: 'walk',  label: t('travel.walk'),  minutes: pos.walkingTimeMinutes },
        { mode: 'bike',  label: t('travel.bike'),  minutes: pos.bikingTimeMinutes },
        { mode: 'drive', label: t('travel.drive'), minutes: pos.drivingTimeMinutes }
    ];
    const presentTravelModes = travelModes.filter(m =>
        m.minutes !== undefined && m.minutes !== null && !isNaN(parseFloat(m.minutes))
    );
    let travelTimesHtml = "";
    if (presentTravelModes.length > 0) {
        const travelDistanceKm = pos.distance !== undefined && pos.distance !== null && !isNaN(parseFloat(pos.distance))
            ? parseFloat(pos.distance) : null;
        const compactTravelTimes = travelDistanceKm !== null && travelDistanceKm > 100;
        const travelItemsHtml = presentTravelModes.map(m => `
            <span class="log-card-travel-item" title="${t('history.estimatedTime', { mode: m.label })}" aria-label="${t('history.timeAria', { mode: m.label, time: formatTravelTime(parseFloat(m.minutes)) })}">
                ${getTravelIconSvg(m.mode)}
                <span>${formatTravelTime(parseFloat(m.minutes), compactTravelTimes)}</span>
            </span>
        `).join("");
        travelTimesHtml = `<div class="log-card-travel-times">${travelItemsHtml}</div>`;
    }

    const travelRowHtml = (travelTimesHtml !== "" || distanceHtml !== "")
        ? `<div class="log-card-travel-row">${travelTimesHtml}${distanceHtml}</div>`
        : "";

    const dateFormatted      = formatRelativeDate(pos.timestamp);
    const shortAddress       = formatShortAddress(pos);
    const locationIcon       = getLocationIconSvg(pos.osmCategory, pos.osmType);
    const fullAddressForTitle = pos.displayName || t('common.noDetailedAddress');
    const elevationFormatted = formatElevation(pos.elevation);

    const isLowAccuracy    = pos.accuracy && parseFloat(pos.accuracy) > 30;
    const badgeBgColor     = isLowAccuracy ? '#fef3c7' : '#f1f5f9';
    const badgeTextColor   = isLowAccuracy ? '#b45309' : 'var(--text-muted)';
    const roundedAccuracy  = pos.accuracy ? Math.round(pos.accuracy) : '?';

    // --- Direction from the current position ---
    // Origin is the same GPS fix the backend used for `distance`/travel times,
    // so arrow, letters and distance chip all describe one and the same move.
    // Omitted entirely when there is no fix (GPS denied/unavailable). Within
    // DIRECTION_MIN_DISTANCE_M the badge is rendered but hidden (the 8-point
    // letter is meaningless there); applyOrigin() re-evaluates that live as the
    // user moves, so it reappears once they walk away.
    // The arrow carries NO inline rotation: registerDirectionArrow() paints it
    // from bearing + needle heading so it keeps tracking while the page is open.
    // The letters stay absolute (true compass direction) by design.
    const bearing = origin ? bearingDegrees(origin.latitude, origin.longitude, pos.latitude, pos.longitude) : NaN;
    const compass = compassPoint(bearing);
    const originDistanceM = origin
        ? distanceMeters(origin.latitude, origin.longitude, pos.latitude, pos.longitude)
        : NaN;
    const near = !isNaN(originDistanceM) && originDistanceM < DIRECTION_MIN_DISTANCE_M;
    const directionLabel = compass ? t('history.directionTitle', { direction: directionName(compass) }) : '';
    const directionHtml = compass
        ? `<span class="log-card-direction${near ? ' hidden' : ''}" title="${directionLabel}" aria-label="${directionLabel}">
            <svg class="log-direction-arrow" style="stroke: var(--text-muted);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 20 21 12 17 4 21"></polygon>
            </svg>
            <span>${directionShort(compass)}</span>
        </span>`
        : '';

    const tagHtml = pos.tag
        ? `<span class="log-card-tag" title="${t('history.tagTitle', { tag: pos.tag })}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
            </svg>
            ${pos.tag}
        </span>`
        : '';

    const commentHtml = (pos.comment && pos.comment.trim() !== '')
        ? `<div class="log-card-comment">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>${pos.comment}</span>
        </div>`
        : '';

    card.innerHTML = `
        <div class="log-card-clickable-area">
            <div class="log-card-header">
                <div>
                    <span class="log-card-id">#${index + 1}</span>
                    <span style="margin-left: 6px;">${dateFormatted}</span>${tagHtml}
                </div>
                <div class="log-card-meta">
                    ${directionHtml}
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
            </div>
            <div class="log-card-body">
                <div style="flex: 1; min-width: 0;">
                    <div class="log-card-address address-container" title="${fullAddressForTitle}">
                        ${locationIcon}
                        <span>${shortAddress}${elevationFormatted ? ` <span class="log-card-elevation">(${elevationFormatted})</span>` : ''}</span>
                    </div>
                    ${commentHtml}
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0;">
                    <div class="log-card-temp ${tempClass}">
                        ${weatherIconSvg}
                        <span>${tempFormatted}</span>
                    </div>
                    ${uvHtml}
                </div>
            </div>
            ${travelRowHtml}
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
                ${t('history.maps')}
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
                ${t('history.share')}
            </button>
            <button class="tray-action-btn btn-action-delete" data-id="${pos.id}">
                <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                ${t('history.delete')}
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
                shareBtn.textContent = t('history.copied');
                setTimeout(() => {
                    shareBtn.innerHTML = `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> ${t('history.share')}`;
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
                        listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--text-muted); font-size:0.9rem; padding:20px 0;">${t('history.noLocations', { userId: activeUserId })}</div>`;
                    }
                });
                checkBackendStatus();
            })
            .catch(err => {
                if (err && err.status === 429) {
                    alert(t('errors.tooManyRequests'));
                } else {
                    alert(t('history.errorRemoving', { message: err.message }));
                }
                checkBackendStatus();
            });
    });

    // Hand the arrow to the live-rotation engine (no-op without an origin).
    if (directionHtml) registerDirectionArrow(card, pos, bearing);

    return card;
}

/* ==========================================================================
   Pull-to-Refresh
   ========================================================================== */
const PTR_THRESHOLD    = 72;
const PTR_MAX_PULL     = 96;
const PTR_INDICATOR_ID = 'ptr-indicator';

function ensurePtrIndicator() {
    if (document.getElementById(PTR_INDICATOR_ID)) return;
    const el = document.createElement('div');
    el.id = PTR_INDICATOR_ID;
    el.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="4" x2="12" y2="20"></line>
            <polyline points="6 14 12 20 18 14"></polyline>
        </svg>`;
    const list = document.getElementById('history-list');
    list.parentNode.insertBefore(el, list);
}

function initPullToRefresh(deps) {
    const page      = document.getElementById('page-history');
    const list      = document.getElementById('history-list');
    const indicator = document.getElementById(PTR_INDICATOR_ID);

    let startY     = 0;
    let pulling    = false;
    let refreshing = false;

    function setIndicatorProgress(pullY) {
        const ratio   = Math.min(pullY / PTR_THRESHOLD, 1);
        const clamped = Math.min(pullY, PTR_MAX_PULL);
        indicator.style.height  = `${clamped * 0.6}px`;
        indicator.style.opacity = `${ratio}`;
        indicator.querySelector('svg').style.transform = `rotate(${ratio * 360}deg)`;
    }

    function resetIndicator() {
        indicator.style.height  = '0px';
        indicator.style.opacity = '0';
        indicator.classList.remove('ptr-spinning');
        indicator.querySelector('svg').style.transform = 'rotate(0deg)';
    }

    function triggerRefresh() {
        refreshing = true;
        indicator.style.opacity = '0';
        indicator.style.height  = '0px';

        fetchAndRenderHistory(deps);

        setTimeout(() => {
            resetIndicator();
            refreshing = false;
        }, 800);
    }

    page.addEventListener('touchstart', (e) => {
        // Map-View: Pull-to-Refresh aus, damit Pinch-Zoom/Pan der Leaflet-Karte
        // keinen Reload auslöst. In der List-View bleibt PTR aktiv.
        if (getCurrentHistoryView() === 'map') return;
        if (refreshing) return;
        if (list.scrollTop > 0) return;
        startY  = e.touches[0].clientY;
        pulling = true;
    }, { passive: true });

    page.addEventListener('touchmove', (e) => {
        if (getCurrentHistoryView() === 'map') return;
        if (!pulling || refreshing) return;
        const pullY = e.touches[0].clientY - startY;
        if (pullY <= 0) { pulling = false; return; }
        setIndicatorProgress(pullY);
    }, { passive: true });

    page.addEventListener('touchend', (e) => {
        if (!pulling || refreshing) return;
        pulling = false;
        const pullY = e.changedTouches[0].clientY - startY;
        if (pullY >= PTR_THRESHOLD) {
            triggerRefresh();
        } else {
            resetIndicator();
        }
    }, { passive: true });
}

/* ==========================================================================
   Skeleton Loader – sofortiges visuelles Feedback vor dem API-Call
   ========================================================================== */
function buildSkeletonCard() {
    const card = document.createElement('div');
    card.className = 'skeleton-card';
    card.innerHTML = `
        <div class="skeleton-card-header">
            <div class="skel skel-id"></div>
            <div class="skel skel-badge"></div>
        </div>
        <div class="skeleton-card-body">
            <div class="skel skel-address-line"></div>
            <div class="skel skel-address-line skel-address-short"></div>
            <div class="skel skel-temp"></div>
        </div>
    `;
    return card;
}

export function showHistorySkeleton() {
    const listContainer = document.getElementById('history-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        listContainer.appendChild(buildSkeletonCard());
    }
}

/* ==========================================================================
   Search / Filter
   Kombiniert einen Tag (exakte Single-Select-Chips wie im Locate-Save-Screen)
   mit einem Textterm über Adresse/Kommentar:
   - Tag UND Text gesetzt  -> AND-Filter (Tag muss passen UND Adresse/Kommentar)
   - nur Tag / nur Text    -> Filter auf das gesetzte Kriterium allein
   Das Match-Prädikat liegt zentral in utils.js (posMatchesFilter) und wird vom
   Map-View identisch über den State (getHistoryFilter) angewandt.
   ========================================================================== */
function applyFilter(filter) {
    const cards = document.querySelectorAll('#history-list .log-card');
    let visibleCount = 0;
    cards.forEach(card => {
        const matches = posMatchesFilter(card._pos, filter);
        card.classList.toggle('hidden', !matches);
        if (matches) visibleCount++;
    });

    const noResult = document.getElementById('history-no-results');
    if (noResult) noResult.classList.toggle('hidden', visibleCount !== 0);
}

function getSelectedHistoryTag() {
    const tagsEl = document.getElementById('history-filter-tags');
    if (!tagsEl) return '';
    const selected = tagsEl.querySelector('.tag-chip--selected');
    return selected ? selected.getAttribute('data-tag') : '';
}

function ensureSearchBar() {
    if (document.getElementById('history-search-bar')) return;

    // Aufklappbarer Filter (Disclosure), optisch identisch zum Locate
    // "Tag & Comment"-Block (.save-options): kompakt eingeklappt mit Summary,
    // erweitert zeigt Tag-Chips + Adresse/Kommentar-Eingabe.
    const bar = document.createElement('div');
    bar.id = 'history-search-bar';
    bar.className = 'history-search-bar save-options';
    bar.innerHTML = `
        <button id="history-filter-toggle" class="save-options-toggle" type="button" aria-expanded="false">
            <svg class="save-options-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            <span class="save-options-toggle-label">${t('history.filter')}</span>
            <span id="history-filter-summary" class="save-options-summary hidden"></span>
            <svg class="save-options-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        </button>
        <div class="save-options-body">
            <div class="save-options-inner">
                <div class="save-options-row">
                    <span class="label">${t('label.tag')}</span>
                    <div id="history-filter-tags" class="tag-chips"></div>
                </div>
                <div class="save-options-row">
                    <span class="label">${t('history.addressComment')}</span>
                    <div class="history-search-input-wrapper">
                        <svg class="history-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input id="history-search-input" class="history-search-input"
                               type="search" placeholder="${t('history.filterPlaceholder')}" autocomplete="off">
                        <button id="history-search-clear" class="history-search-clear hidden" aria-label="${t('history.clearFilter')}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                                 stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            <div id="history-no-results" class="history-no-results hidden">${t('history.noMatches')}</div>
        </div>
    `;

    const list = document.getElementById('history-list');
    list.parentNode.insertBefore(bar, list);

    const toggle   = bar.querySelector('#history-filter-toggle');
    const input    = bar.querySelector('#history-search-input');
    const clearBtn = bar.querySelector('#history-search-clear');
    const tagsEl   = bar.querySelector('#history-filter-tags');
    const summary  = bar.querySelector('#history-filter-summary');

    // Disclosure: auf-/zuklappen (gleiche Logik wie Locate save-options)
    toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        bar.classList.toggle('expanded', !expanded);
    });

    // Tag-Chips (Single-Select wie im Locate-Save-Screen): aktiven Chip
    // erneut antippen, um den Tag-Filter zu entfernen.
    PREDEFINED_TAGS.forEach(tag => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'tag-chip';
        chip.setAttribute('data-tag', tag);
        chip.textContent = tag;
        tagsEl.appendChild(chip);
    });

    // Liest die UI-Steuerungen aus, schreibt sie in den State (Map-View liest
    // denselben State), wendet den Filter an und aktualisiert die Summary.
    const syncFromControls = () => {
        const tag  = getSelectedHistoryTag();
        const text = input.value.trim();
        setHistoryFilter({ tag, text });
        applyFilter({ tag, text });
        clearBtn.classList.toggle('hidden', text === '');

        const parts = [];
        if (tag) parts.push(tag);
        if (text) parts.push(text);
        summary.textContent = parts.join(' \u00B7 ');
        summary.classList.toggle('hidden', parts.length === 0);
    };

    tagsEl.addEventListener('click', (e) => {
        const chip = e.target.closest('.tag-chip');
        if (!chip) return;
        const wasSelected = chip.classList.contains('tag-chip--selected');
        tagsEl.querySelectorAll('.tag-chip--selected').forEach(c => c.classList.remove('tag-chip--selected'));
        if (!wasSelected) chip.classList.add('tag-chip--selected');
        syncFromControls();
    });

    input.addEventListener('input', syncFromControls);

    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.classList.add('hidden');
        syncFromControls();
        input.focus();
    });
}

function resetSearchBar() {
    // Filter beim Reload leeren, damit kein alter Tag/Text weiter filtert
    const input     = document.getElementById('history-search-input');
    const clearBtn  = document.getElementById('history-search-clear');
    const tagsEl    = document.getElementById('history-filter-tags');
    const noResults = document.getElementById('history-no-results');
    const summary   = document.getElementById('history-filter-summary');
    if (input)    { input.value = ''; }
    if (clearBtn) { clearBtn.classList.add('hidden'); }
    if (tagsEl) {
        tagsEl.querySelectorAll('.tag-chip--selected').forEach(c => c.classList.remove('tag-chip--selected'));
    }
    if (noResults) { noResults.classList.add('hidden'); }
    if (summary)  { summary.textContent = ''; summary.classList.add('hidden'); }
    setHistoryFilter({ tag: '', text: '' });
}

/* ==========================================================================
   Offline-Banner – zeigt an, dass die History aus dem SW-Cache stammt
   (X-LocateMe-Cache-Header), nicht vom Backend.
   ========================================================================== */
const OFFLINE_BANNER_ID = 'offline-banner';

function ensureOfflineBanner() {
    if (document.getElementById(OFFLINE_BANNER_ID)) return;
    const page = document.getElementById('page-history');
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
        <span>${t('history.offlineCached')}</span>`;
    page.insertBefore(banner, page.firstChild);
}

function setOfflineBanner(show) {
    const banner = document.getElementById(OFFLINE_BANNER_ID);
    if (banner) banner.classList.toggle('hidden', !show);
}

/* ==========================================================================
   fetchAndRenderHistory – Haupt-Einstiegspunkt, wird beim Tab-Wechsel aufgerufen
   deps = { getActiveUserId, checkBackendStatus }
   ========================================================================== */
export function fetchAndRenderHistory(deps) {
    const { getActiveUserId, checkBackendStatus } = deps;
    const listContainer = document.getElementById('history-list');

    // PTR + Indicator einmalig initialisieren
    ensurePtrIndicator();
    if (!listContainer.dataset.ptrReady) {
        initPullToRefresh(deps);
        listContainer.dataset.ptrReady = 'true';
    }

    // Skeleton wurde bereits von app.js gesetzt – nur sicherstellen falls
    // fetchAndRenderHistory direkt aufgerufen wird (z.B. Pull-to-Refresh)
    if (!listContainer.querySelector('.skeleton-card')) {
        showHistorySkeleton();
    }

    const activeUserId = getActiveUserId();

    const fetchWithCoords = (lat, lon) => {
        ensureOfflineBanner();
        // The fix doubles as the reference point for the direction badge, so it
        // is kept alongside the request (null when the fetch runs without one).
        const origin = lat !== null && lon !== null ? { latitude: lat, longitude: lon } : null;
        apiGetPositionsWithMeta(activeUserId, lat, lon)
            .then(({ data, fromCache }) => {
                setOfflineBanner(fromCache);
                listContainer.innerHTML = "";
                // The cards are about to be replaced: drop the arrow references
                // of the previous render so the heading stream cannot touch
                // detached elements.
                clearDirectionArrows();

                if (!data || !Array.isArray(data) || data.length === 0) {
                    listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--text-muted); font-size:0.9rem; padding:20px 0;">${t('history.noLocations', { userId: activeUserId })}</div>`;
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
                        const card = buildHistoryCard(pos, index, activeUserId, listContainer, { checkBackendStatus, origin });
                        listContainer.appendChild(card);
                    } catch (itemError) {
                        console.error("Skipped rendering corrupted log item:", pos, itemError);
                    }
                });

                // Suchfeld einmalig anlegen, Term nach Reload zurücksetzen
                ensureSearchBar();
                resetSearchBar();

                // Seed the live origin with the fix this render used, so the
                // movement gate can measure real displacement from here on.
                if (origin) liveOrigin = origin;

                checkBackendStatus();
            })
            .catch(err => {
                setOfflineBanner(false);
                if (err && err.status === 429) {
                    listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--text-muted); font-size:0.9rem; padding:20px 0;">${t('errors.tooManyRequests')}</div>`;
                } else if (!navigator.onLine) {
                    listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--text-muted); font-size:0.9rem; padding:20px 0;">${t('history.offlineNone')}</div>`;
                } else {
                    listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--error-color, #dc2626); font-size:0.9rem; padding:20px 0;">${t('history.error', { message: err.message })}</div>`;
                }
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

/* ==========================================================================
   Language-Change Support: drop the dynamically created widgets that carry
   translated text (filter bar incl. the empty-result hint, offline banner).
   Both early-return when re-created, so removing them makes the next History
   visit rebuild them in the new language. The log cards themselves are already
   rebuilt by fetchAndRenderHistory on every visit.
   Called from app.js on "i18n:languagechanged".
   ========================================================================== */
export function invalidateHistoryI18n() {
    document.getElementById('history-search-bar')?.remove();
    document.getElementById(OFFLINE_BANNER_ID)?.remove();
}

/* Self-contained live-arrow bootstrap (module scripts run after the DOM is
   parsed, so the nav items and #page-history exist here). */
initHistoryLive();