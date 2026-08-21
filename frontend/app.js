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
   Demo Mode Note: flashing hint on the Locate page while the app runs with
   the default "user123" ID. Hidden once a custom User ID is set.
   ========================================================================== */
function updateDemoModeNote() {
    const note = document.getElementById('demo-mode-note');
    if (!note) return;
    note.classList.toggle('hidden', getActiveUserId() !== 'user123');
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
   PWA Service Worker – Registrierung
   Workbox-basierter SW (Network-First, siehe sw.js): liefert index.html,
   JS-Module und CSS online immer frisch und dient offline als Fallback.
   ========================================================================== */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.error('Service Worker registration failed:', err);
        });
    }
}

/* ==========================================================================
   App Bootstrap
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {

    initMapListeners();

    initSettingsPage({
        onSave: (userId) => {
            silentBadgeSync(userId, checkBackendStatus);
            updateDemoModeNote();
        },
        getActiveUserId
    });

    initLocatePage({
        getActiveUserId,
        checkBackendStatus,
        silentBadgeSync
    });

    updateDemoModeNote();

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