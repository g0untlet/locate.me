/* ==========================================================================
   imports
   ========================================================================== */
import {
    formatRelativeDate,
    formatShortAddress,
    formatWalkingTime,
    getWeatherText,
    getWeatherIconSvg,
    getLocationIconSvg
} from './js/utils.js';

import {
    apiGetSystemInfo,
    apiGetPositions,
    apiGetCurrentPosition,
    apiPostPosition,
    apiDeletePosition
} from './js/api.js';

import {
    getHistoryMap, setHistoryMap,
    getHistoryMapData, setHistoryMapData,
    getCurrentHistoryView, setCurrentHistoryView,
    getCachedLocatePosition, setCachedLocatePosition,
    getLocateMap, setLocateMap,
    getLocateMarker, setLocateMarker
} from './js/state.js';

import { showStatusToast } from './js/ui/toast.js';

import { updateHistoryBadge, silentBadgeSync } from './js/ui/badge.js';

import { checkBackendStatus, showError } from './js/ui/status.js';

import { setHistoryView, renderMapMarkers, showLocateMap, initMapListeners } from './js/ui/map.js';

import { initSettingsPage } from './js/pages/settings.js';

import { initLocatePage } from './js/pages/locate.js';

import { fetchAndRenderHistory } from './js/pages/history.js';


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
            fetchAndRenderHistory({ getActiveUserId, checkBackendStatus });
        } else {
            setHistoryView('list');
        }
        
    });
});


/* ==========================================================================
   Global Helper: Dynamically extract active User ID from LocalStorage
   ========================================================================== */
function getActiveUserId() {
    const savedId = localStorage.getItem('userId');
    return (savedId && savedId.trim() !== "") ? savedId.trim() : "user123";
}


/* ==========================================================================
   Page 3: LocalStorage Settings Engine & Lifecycle Lifecycle Hooks
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    initMapListeners();
    
    initSettingsPage({  
        onSave: (userId) => silentBadgeSync(userId, checkBackendStatus),
        getActiveUserId
    });

    initLocatePage({ 
        getActiveUserId,
        checkBackendStatus,
        silentBadgeSync
    });

    // Tap on status indicator: re-check backend and show toast
    const statusIndicator = document.querySelector('.header-status-indicator');
    if (statusIndicator) {
        statusIndicator.style.cursor = 'pointer';
        statusIndicator.addEventListener('click', () => checkBackendStatus(true));
    }

    // Trigger 1: Core Startup Sequence
    silentBadgeSync(getActiveUserId(), checkBackendStatus);
    checkBackendStatus();
});

// Trigger 3: Event-driven recovery when app moves back into foreground
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        checkBackendStatus();
    }
});



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