/* ==========================================================================
   locate.me – Application Entry Point
   Importiert alle Module und verdrahtet die App-Initialisierung.
   ========================================================================== */
import { checkBackendStatus } from './js/ui/status.js';
import { silentBadgeSync } from './js/ui/badge.js';
import { setHistoryView, initMapListeners } from './js/ui/map.js';
import { initSettingsPage } from './js/pages/settings.js';
import { initLocatePage } from './js/pages/locate.js';
import { fetchAndRenderHistory, showHistorySkeleton } from './js/pages/history.js';

/* ==========================================================================
   Global Helper: Aktive User-ID aus LocalStorage lesen
   Default: "user123" wenn nicht gesetzt oder leer.
   ========================================================================== */
function getActiveUserId() {
    const savedId = localStorage.getItem('userId');
    return (savedId && savedId.trim() !== "") ? savedId.trim() : "user123";
}

/* ==========================================================================
   SPA Navigation Framework (Tab Controller)
   ========================================================================== */
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const targetPageId = button.getAttribute('data-target');
            document.querySelectorAll('.app-page').forEach(page => page.classList.add('hidden'));
            document.getElementById(targetPageId).classList.remove('hidden');

            if (targetPageId === 'page-history') {
                showHistorySkeleton();
                fetchAndRenderHistory({ getActiveUserId, checkBackendStatus });
            } else {
                // Leaving history page: reset to list view so next visit starts fresh
                setHistoryView('list');
            }
        });
    });
}

/* ==========================================================================
   PWA Service Worker Registration
   ========================================================================== */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(reg => {
                    console.log('Service Worker successfully registered!', reg.scope);
                    // Sofort auf Updates prüfen – verhindert dass alter SW ewig läuft
                    reg.update();
                })
                .catch(err => console.error('Service Worker Registration failed:', err));
        });
    }
}

/* ==========================================================================
   App Bootstrap
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

    initNavigation();

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

registerServiceWorker();