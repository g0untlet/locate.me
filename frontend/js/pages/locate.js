import { apiGetCurrentPosition, apiGetPlaces, apiPostPosition, TOO_MANY_REQUESTS_MESSAGE } from '../api.js';
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
    formatShortAddress,
    PREDEFINED_TAGS
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

/* Fetch-Epochen-Zähler: inkrementiert bei jedem neuen Fetch/Refresh. Verhindert,
   dass eine langsame (Geoapify-)Places-Antwort einer älteren Runde in eine
   neuere Runde hineinfunkt (Stale-Guard). */
let fetchEpoch = 0;

/* Zeit-Label ("HH:MM") der zuletzt gerenderten Vorschau – wird beim "Back" aus
   der Saved-Ansicht genutzt, um den Chooser-Status wiederherzustellen. */
let lastPreviewLabel = '';

function setFetchBusy(busy) {
    isFetching = busy;
    const btn = document.getElementById('btn-fetch-location');
    if (btn) btn.disabled = busy;
}

/* ==========================================================================
   Compass (North) – kleine Kompassnadel im "PLACES AROUND ME"-Header. Die
   rote Hälfte der Nadel zeigt immer nach Norden, während sich der User dreht.
   Ohne Sensor-Events (oder nach verweigerter iOS-Permission) bleibt der Dial
   verborgen (compassAvailable bleibt false).

   Android/Brave/Desktop: Start erfolgt direkt beim Seiten-Init (keine
   Permission nötig); gehört wird sowohl deviceorientation (Fallback) als auch
   deviceorientationabsolute (echtes Nord-Heading, wenn verfügbar). Brave kann
   die Orientierungssensoren per Shields/Fingerprinting-Schutz still legen –
   dann greift der No-Signal-Watchdog mit einem konkreten Hinweis.
   iOS: Permission über requestPermission() innerhalb der Fetch-User-Geste.
   ========================================================================== */
let compassAvailable    = false; // erster echter Orientation-Event empfangen?
let compassLastAngle    = null;  // fortlaufend akkumulierter Rotationswinkel
let compassStarted      = false;
let compassUseAbsolute  = false; // absolute Events liefern echtes Nord-Heading
let compassWarnedNoSens = false;

const COMPASS_NO_SIGNAL_WARN =
    "No orientation sensor data received — the compass stays hidden. " +
    "If you expected it, allow motion sensors for this site (disable Brave " +
    "Shields fingerprinting protection, or allow sensors in the site settings).";

function getCompassElement() {
    return document.getElementById('places-compass');
}

function updateCompassVisibility() {
    const compass = getCompassElement();
    if (!compass) return;
    const card = document.getElementById('places-card');
    const show  = compassAvailable && card && !card.classList.contains('hidden');
    compass.classList.toggle('hidden', !show);
}

/* Android/Chrome & Brave liefern keinen tilt-kompensierten Compass-Wert wie
   iOS webkitCompassHeading. Deren alpha/beta/gamma folgen der Gegen-Drehrichtung
   (CCW). Die Nadel dreht deshalb um den rohen Yaw (+). Falls ein Gerät die
   Werte gespiegelt meldet (Nord zeigt 180° daneben), hier auf -1 stellen. */
const DEG_TO_RAD = Math.PI / 180;
const ANDROID_ROTATION_SIGN = 1;

/* Tilt-kompensierter Gier-Winkel (0..360) aus alpha/beta/gamma. Bei flach
   gehaltenem Gerät reduziert sich das Ergebnis auf alpha; im aufrechten
   Halten (z.B. beim Lesen der Liste) wird die Neigung ausgeglichen. */
function computeYawDeg(alpha, beta, gamma) {
    const a = alpha * DEG_TO_RAD;
    const b = beta  * DEG_TO_RAD;
    const g = gamma * DEG_TO_RAD;
    const yaw = Math.atan2(
        Math.sin(a) * Math.cos(b) + Math.cos(a) * Math.sin(b) * Math.sin(g),
        Math.cos(a) * Math.cos(b) - Math.sin(a) * Math.sin(b) * Math.sin(g)
    );
    return (yaw * 180 / Math.PI + 360) % 360;
}

/* Zentrale Verarbeitung eines Nadel-Rotationswinkels in Grad (Screen-Frame,
   das rote Nadel-Ende zeigt Richtung Norden). Kümmert sich um Sichtbarkeit,
   den Shortest-Path-Akkumulator und die Nadel-Rotation. */
function applyCompassRotation(rotationDeg) {
    const compass = getCompassElement();
    if (!compass) return;

    if (!compassAvailable) {
        compassAvailable = true;
        updateCompassVisibility();
    }
    if (compass.classList.contains('hidden') || compass.offsetParent === null) return;

    // Shortest-Path-Akkumulator verhindert eine volle Umdrehung am 359°->0°-Wrap.
    const target = (rotationDeg % 360 + 360) % 360;
    let angle;
    if (compassLastAngle === null) {
        angle = target;
    } else {
        let delta = target - compassLastAngle;
        if (delta > 180)  delta -= 360;
        if (delta < -180) delta += 360;
        angle = compassLastAngle + delta;
    }
    compassLastAngle = angle;

    const needle = compass.querySelector('.compass-needle');
    if (!needle) return;
    // Erster Event: ohne Transition anwenden, damit die Nadel nicht von der
    // Ausgangslage (0°) einmal schnell herumspult – danach CSS-Transition wieder.
    if (compassLastAngle === target && !needle.dataset.compassInit) {
        needle.dataset.compassInit = '1';
        needle.style.transition = 'none';
    }
    needle.style.transform = `rotate(${compassLastAngle}deg)`;
    if (needle.style.transition === 'none') {
        requestAnimationFrame(() => { needle.style.transition = ''; });
    }
}

/* deviceorientation (nicht absolut): iOS Safari liefert webkitCompassHeading
   (= tilt-kompensiertes Heading); Android/Brave liefern stattdessen Raw-
   alpha/beta/gamma. Sobald absolute Events aktiv sind, werden die relativen
   verworfen (eine Quelle, kein Wackeln). */
function onDeviceOrientation(e) {
    if (compassUseAbsolute) return;

    if (typeof e.webkitCompassHeading === 'number') {
        // iOS: rotes Nadel-Ende gegen die (CW-)Peilung drehen
        applyCompassRotation(-e.webkitCompassHeading);
        return;
    }
    if (e.alpha === null || e.alpha === undefined ||
        e.beta  === null || e.beta  === undefined ||
        e.gamma === null || e.gamma === undefined) return;
    const yaw = computeYawDeg(e.alpha, e.beta, e.gamma);
    applyCompassRotation(ANDROID_ROTATION_SIGN * yaw);
}

/* deviceorientationabsolute: alpha/beta/gamma sind hier absolut (echtes
   Nord-Heading; Chrome/Android liefert dieses Event, wenn der Sensor erlaubt
   ist). */
function onDeviceOrientationAbsolute(e) {
    if (e.alpha === null || e.alpha === undefined ||
        e.beta  === null || e.beta  === undefined ||
        e.gamma === null || e.gamma === undefined) return;
    compassUseAbsolute = true;
    const yaw = computeYawDeg(e.alpha, e.beta, e.gamma);
    applyCompassRotation(ANDROID_ROTATION_SIGN * yaw);
}

/* Schaltet die Sensor-Listener ein (auf beiden Event-Quellen) und prüft die
   Sensor-Permission – rein diagnostisch, damit ein stilles Blockieren (z.B.
   Brave Shields) nicht unbemerkt bleibt. */
function startCompass() {
    if (compassStarted) return;
    if (!('DeviceOrientationEvent' in window)) return;
    window.addEventListener('deviceorientation', onDeviceOrientation);
    window.addEventListener('deviceorientationabsolute', onDeviceOrientationAbsolute);
    compassStarted = true;
    checkSensorPermissions();
}

function checkSensorPermissions() {
    if (!('permissions' in navigator) || typeof navigator.permissions.query !== 'function') return;
    ['gyroscope', 'magnetometer', 'accelerometer'].forEach(name => {
        navigator.permissions.query({ name }).then(status => {
            if (status.state === 'denied') {
                console.warn(
                    `Motion sensor "${name}" is blocked for this site — the compass stays hidden. ` +
                    "Allow sensors for the site (site settings / Brave Shields fingerprinting protection off)."
                );
            }
        }).catch(() => { /* Permission-Name hier nicht unterstützt – ignorieren */ });
    });
}

/* No-Signal-Watchdog: Falls die Places-Card sichtbar ist und nach 6 s immer
   noch kein einziges Orientation-Event ankam, einmalig einen konkreten Hinweis
   loggen (statt den Dial nur stillschweigend verborgen zu lassen). */
function scheduleCompassWatchdog() {
    if (compassWarnedNoSens || compassAvailable) return;
    setTimeout(() => {
        if (compassWarnedNoSens || compassAvailable) return;
        const page = document.getElementById('page-locate');
        if (!page || page.classList.contains('hidden')) return; // beim nächsten Besuch erneut prüfen
        compassWarnedNoSens = true;
        console.warn(COMPASS_NO_SIGNAL_WARN);
    }, 6000);
}

/* Seiten-Init: Android/Brave/Desktop ohne Permission-Gate sofort lauschen.
   iOS startet erst über die Permission in der Fetch-User-Geste. */
function initCompass() {
    const req = window.DeviceOrientationEvent && window.DeviceOrientationEvent.requestPermission;
    if (typeof req !== 'function') {
        startCompass();
    }
}

/* iOS 13+: DeviceOrientationEvent.requestPermission() nur innerhalb einer
   User-Geste (eingehängt in den "Fetch Location"-Tap). Android/Desktop
   brauchen keine Permission – dort sofort starten. */
function requestCompassPermission() {
    const req = window.DeviceOrientationEvent && window.DeviceOrientationEvent.requestPermission;
    if (typeof req !== 'function') {
        startCompass();
        return;
    }
    req.call(window.DeviceOrientationEvent)
        .then(state => {
            if (state === 'granted') startCompass();
            // denied / prompt -> Compass bleibt verborgen
        })
        .catch(() => {});
}

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
   Renders up to MAX_PLACES rows, matching the backend's aroundme.max-places.
   ========================================================================== */
const MAX_PLACES = 20;

/* Sentinel für einen fehlgeschlagenen Places-Fetch (Timeout/503/Netz). Eine
   echte Geoapify-Antwort ist immer ein Array – null heißt "nicht ladbar". */
const PLACES_UNAVAILABLE = null;

/* ==========================================================================
   Internal: Places-Ergebnis verteilen – Fehlschlag (null) zeigt eine Meldung,
   ein Array wird als Liste gerendert (leer = Card aus).
   ========================================================================== */
function renderPlacesResult(places) {
    if (places === PLACES_UNAVAILABLE) {
        renderPlacesError();
    } else {
        renderPlacesList(places);
    }
}

function renderPlacesList(places) {
    const card  = document.getElementById('places-card');
    const list  = document.getElementById('places-list');
    const count = document.getElementById('places-count');
    if (!card || !list) return;

    card.removeAttribute('aria-busy');
    list.innerHTML = '';
    const top = Array.isArray(places) ? places.slice(0, MAX_PLACES) : [];

    if (top.length === 0) {
        card.classList.add('hidden');
        return;
    }

    card.classList.remove('hidden');
    if (count) {
        count.textContent = `${top.length} place${top.length === 1 ? '' : 's'}`;
    }

    // Compass-Dial nur sichtbar, wenn Sensor-Events vorhanden sind
    updateCompassVisibility();
    scheduleCompassWatchdog();

    top.forEach(place => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'place-row';
        row.setAttribute('aria-pressed', 'false');
        const direction = place.direction || '';
        row.innerHTML = `
            ${getPlaceIconSvg(place.primaryCategory)}
            <span class="place-row-name">${escapeHtml(place.name || place.formattedAddress || 'Unknown place')}</span>
            <span class="place-row-distance">${formatDistanceMeters(place.distance)}${direction ? ` ${direction}` : ''}</span>
        `;
        row.addEventListener('click', () => selectPlace(place, row));
        list.appendChild(row);
    });
}

/* ==========================================================================
   Internal: Places loading state – zeigt die Places-Card mit Shimmer-
   Platzhaltern + Hinweistext, solange die Geoapify-Antwort aussteht.
   Wird von renderPlacesList (Erfolg/leer) ersetzt bzw. ausgeblendet.
   ========================================================================== */
function showPlacesLoading() {
    const card  = document.getElementById('places-card');
    const list  = document.getElementById('places-list');
    const count = document.getElementById('places-count');
    if (!card || !list) return;

    card.classList.remove('hidden');
    card.setAttribute('aria-busy', 'true');
    if (count) count.textContent = 'Looking for places\u2026';

    const skeletonRow =
        '<div class="place-row place-row--loading" aria-hidden="true">' +
            '<span class="skel skel-place-icon"></span>' +
            '<span class="skel place-row-skel-name"></span>' +
            '<span class="skel skel-place-dist"></span>' +
        '</div>';
    list.innerHTML = skeletonRow + skeletonRow + skeletonRow;
}

/* ==========================================================================
   Internal: Places-Fehlerzustand – ersetzt den Ladezustand durch eine dezente
   Meldung, wenn Places nicht geladen werden konnten (Timeout/503/Netz).
   ========================================================================== */
function renderPlacesError() {
    const card  = document.getElementById('places-card');
    const list  = document.getElementById('places-list');
    const count = document.getElementById('places-count');
    if (!card || !list) return;

    card.removeAttribute('aria-busy');
    if (count) count.textContent = '';
    card.classList.remove('hidden');
    list.innerHTML = `<div class="places-error" role="status">Couldn't load places around you right now.</div>`;
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
   parallel. The chooser (weather/address) is shown as soon as the preview is
   ready; the places list fills in asynchronously when Geoapify answers. A
   places failure degrades gracefully to the address-only chooser.
   ========================================================================== */
function fetchCurrentPosition(position, { getActiveUserId, checkBackendStatus }) {
    const statusText = document.getElementById('status');
    const fetchBtn   = document.getElementById('btn-fetch-location');

    statusText.innerText = "Fetching location data...";
    statusText.className = "status-loading";

    const { latitude, longitude } = position.coords;
    const userId = getActiveUserId();
    const epoch  = ++fetchEpoch;

    const placesPromise = apiGetPlaces(userId, latitude, longitude)
        .catch(() => PLACES_UNAVAILABLE);

    // Reihenfolge-robuste Verarbeitung: Places darf vor ODER nach dem Preview
    // eintreffen, ohne dass eine der beiden Antworten verloren geht.
    let previewDone   = false; // Vorschau erfolgreich gerendert
    let failed        = false; // Vorschau-Fetch schlug fehl
    let arrived       = false; // Places-Antwort eingetroffen
    let arrivedPlaces = [];

    apiGetCurrentPosition(userId, latitude, longitude)
        .then(data => {
            if (epoch !== fetchEpoch) return; // neuere Runde übernimmt die UI
            const timeLabel = new Date().toLocaleString('de-DE', {
                hour: '2-digit', minute: '2-digit'
            });
            lastPreviewLabel = timeLabel;

            // Vorschau (Adresse/Wetter) sofort rendern; Places füllt später nach.
            renderChooser(data, []);
            previewDone = true;

            setCachedLocatePosition({ ...data, accuracy: position.coords.accuracy });
            fetchBtn.textContent = 'Refresh';
            showView('chooser');
            statusText.innerText = `Preview from ${timeLabel} \u2014 not yet saved.`;
            statusText.className = "status-preview";

            if (arrived) renderPlacesResult(arrivedPlaces);
            else showPlacesLoading();

            checkBackendStatus();
            setOfflineBanner(false);
            setFetchBusy(false);
        })
        .catch(err => {
            if (epoch !== fetchEpoch) return; // neuere Runde übernimmt die UI
            failed = true;
            if (err && err.status === 429) {
                showError(TOO_MANY_REQUESTS_MESSAGE);
                checkBackendStatus();
                setFetchBusy(false);
                return;
            }
            if (!navigator.onLine) {
                ensureOfflineBanner();
                setOfflineBanner(true);
            }
            showError(`Fetch Error: ${err.message}`);
            checkBackendStatus();
            setFetchBusy(false);
        });

    // Places-Antwort unabhängig vom Preview anwenden (nicht blockierend).
    placesPromise.then(places => {
        arrived = true;
        arrivedPlaces = places;
        if (epoch !== fetchEpoch) return; // neuere Fetch-Runde gestartet
        if (failed) return;               // Vorschau schlug fehl -> ignorieren
        if (previewDone) renderPlacesResult(places); // sonst übernimmt der Preview-Pfad
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
            // Preview bewusst NICHT verwerfen: der "Back"-Button der Saved-
            // Ansicht kehrt in den Chooser zurück (Weiter/Save erneut möglich).
            selectedPlace = null;
            document.getElementById('btn-fetch-location').textContent = 'Fetch Location';

            statusText.innerText = "Location successfully saved.";
            statusText.className = "status-success";

            silentBadgeSync(getActiveUserId());
            checkBackendStatus();
        })
        .catch(err => {
            if (err && err.status === 429) {
                showError(TOO_MANY_REQUESTS_MESSAGE);
                checkBackendStatus();
                return;
            }
            showError(`Backend Error: ${err.message}`);
            checkBackendStatus();
        });
}

/* ==========================================================================
   Internal: When a place is selected, save the place's coordinates and use it
   as the saved label. Without a selection (resolved address) the GPS fix
   coordinates are kept. Weather/elevation/accuracy always come from the GPS
   preview.
   ========================================================================== */
function applySelectedPlace(payload) {
    if (!selectedPlace) return;
    const place = selectedPlace;
    payload.latitude = place.latitude;
    payload.longitude = place.longitude;
    payload.osmName = formatPlaceLabel(place);
    if (place.formattedAddress) payload.displayName = place.formattedAddress;
    if (place.street) payload.road = place.street;
    if (place.houseNumber) payload.houseNumber = place.houseNumber;
    if (place.city) payload.city = place.city;
    if (place.country) payload.country = place.country;
    // Persist the place's category so the saved view and history render the
    // same icon the user saw when selecting the place (getLocationIconSvg
    // delegates to getPlaceIconSvg for aroundme categories).
    if (place.primaryCategory) {
        payload.osmCategory = place.primaryCategory;
        payload.osmType = place.secondaryCategory;
    }
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
    // Preview the point that will be saved: the chosen place when one is
    // adopted, otherwise the GPS fix.
    const mapLat = selectedPlace ? selectedPlace.latitude : cached.latitude;
    const mapLon = selectedPlace ? selectedPlace.longitude : cached.longitude;
    showLocateMap(mapLat, mapLon);
}

/* ==========================================================================
   Page Init: Bindet alle Locate-Listener.
   deps = { getActiveUserId, checkBackendStatus, silentBadgeSync }
   ========================================================================== */
export function initLocatePage(deps) {

    initSaveOptions();
    // Android/Brave/Desktop sofort (ohne Permission) auf Sensor-Events hören;
    // iOS startet über die Permission im Fetch-Tap weiter unten.
    initCompass();

    // --- FETCH LOCATION / REFRESH Button ---
    document.getElementById('btn-fetch-location').addEventListener('click', () => {
        if (isFetching) return;
        // iOS braucht die Orientation-Permission in einer User-Geste – der Tap
        // auf den Fetch-Button ist dafür der natürliche Ort.
        requestCompassPermission();
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

    // --- Saver: BACK to chooser view (no backend reload – the chooser state
    //     and the cached preview are still in the DOM) ---
    document.getElementById('btn-back').addEventListener('click', () => showView('chooser'));

    // --- Saved: BACK to the chooser view (weather, resolved address and places
    //     are still in the DOM; the preview cache is kept) ---
    document.getElementById('btn-saved-back').addEventListener('click', () => {
        showView('chooser');
        document.getElementById('btn-fetch-location').textContent = 'Refresh';
        const statusText = document.getElementById('status');
        statusText.innerText = lastPreviewLabel
            ? `Preview from ${lastPreviewLabel} \u2014 not yet saved.`
            : 'Preview \u2014 not yet saved.';
        statusText.className = 'status-preview';
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

        applySelectedPlace(payload);

        sendPositionToBackend(payload, deps);
    });
}
