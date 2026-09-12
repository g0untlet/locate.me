import { apiGetPositionsWithMeta, apiDeletePosition } from '../api.js';
import { setHistoryMapData, getCurrentHistoryView, getHistoryFilter, setHistoryFilter } from '../state.js';
import { t } from '../i18n.js';
import { renderMapMarkers } from '../ui/map.js';
import { updateHistoryBadge } from '../ui/badge.js';
import {
    getWeatherIconSvg,
    getUvLevel,
    getLocationIconSvg,
    getTravelIconSvg,
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
   Internal: Einzelne Log-Card bauen + Listener binden
   ========================================================================== */
function buildHistoryCard(pos, index, activeUserId, listContainer, { checkBackendStatus }) {
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
        if (refreshing) return;
        if (list.scrollTop > 0) return;
        startY  = e.touches[0].clientY;
        pulling = true;
    }, { passive: true });

    page.addEventListener('touchmove', (e) => {
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
        apiGetPositionsWithMeta(activeUserId, lat, lon)
            .then(({ data, fromCache }) => {
                setOfflineBanner(fromCache);
                listContainer.innerHTML = "";

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
                        const card = buildHistoryCard(pos, index, activeUserId, listContainer, { checkBackendStatus });
                        listContainer.appendChild(card);
                    } catch (itemError) {
                        console.error("Skipped rendering corrupted log item:", pos, itemError);
                    }
                });

                // Suchfeld einmalig anlegen, Term nach Reload zurücksetzen
                ensureSearchBar();
                resetSearchBar();

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