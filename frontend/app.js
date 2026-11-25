/* ==========================================================================
   locate.me – Application Entry Point
   Importiert alle Module und verdrahtet die App-Initialisierung.
   ========================================================================== */
import { initI18n } from './js/i18n.js';
import { checkBackendStatus } from './js/ui/status.js';
import { silentBadgeSync } from './js/ui/badge.js';
import { setHistoryView, initMapListeners } from './js/ui/map.js';
import { initInstallPrompt } from './js/ui/install.js';
import { requestHeadingPermission } from './js/ui/compass.js';
import { maybeShowReleaseNotes, openReleaseNotes } from './js/ui/release-notes.js';
import { initSettingsPage } from './js/pages/settings.js';
import { initAuthPage } from './js/pages/auth.js';
import { clearSession } from './js/auth.js';
import { initLocatePage, resetLocatePage } from './js/pages/locate.js';
import {
    fetchAndRenderHistory,
    showHistorySkeleton,
    invalidateHistoryI18n,
    onHistoryPageShown,
    onHistoryPageHidden
} from './js/pages/history.js';

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
            const targetPageId = button.getAttribute('data-target');

            // iOS only grants the motion sensors inside a user gesture, and the
            // tab tap is that gesture. Must stay the FIRST statement here: an
            // await before it would void the gesture and the arrows would stay
            // static. No-op on Android/Brave/Desktop and once already granted.
            if (targetPageId === 'page-history') {
                requestHeadingPermission();
            }

            document.querySelectorAll('.nav-item').forEach(btn => {
                btn.classList.remove('active');
                btn.removeAttribute('aria-current');
            });
            button.classList.add('active');
            button.setAttribute('aria-current', 'page');

            document.querySelectorAll('.app-page').forEach(page => page.classList.add('hidden'));
            document.getElementById(targetPageId).classList.remove('hidden');

            if (targetPageId === 'page-history') {
                // Live direction arrows: subscribe to the heading source and
                // start the movement-gated GPS watcher for this page only.
                onHistoryPageShown();
                showHistorySkeleton();
                fetchAndRenderHistory({ getActiveUserId, checkBackendStatus });
            } else {
                // Leaving history page: reset to list view so next visit starts fresh
                onHistoryPageHidden();
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
   Native-App Feel: Zoom-Guards
   iOS Safari/PWA ignoriert "user-scalable=no", daher zusätzlich:
   - iOS-Gesture-Events (Pinch) unterdrücken
   - Mehrfinger-Pinch außerhalb der Leaflet-Karten unterdrücken
   Einfinger-Scrollen und Leaflet-eigener Zoom bleiben unberührt.
   ========================================================================== */
function initViewportZoomGuards() {
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(type => {
        document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
    });

    document.addEventListener('touchmove', (e) => {
        if (e.touches.length > 1 &&
            !(e.target instanceof Element && e.target.closest('.leaflet-container'))) {
            e.preventDefault();
        }
    }, { passive: false });
}

/* ==========================================================================
   Bottom Navigation: Android standalone reload guard
   A full reload inside an installed PWA can leave the layout viewport taller
   than the visible area, which clips the absolutely positioned bottom nav.
   This guard only lifts the nav when it is actually below the visual viewport,
   so normal iPhone and Android loads are untouched.
   ========================================================================== */
const NAV_SAFE_GAP = 10;
let navCheckTimer = null;

function keepBottomNavVisible() {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;

    document.documentElement.style.removeProperty('--nav-viewport-lift');

    const viewport = window.visualViewport;
    const visibleBottom = viewport
        ? viewport.offsetTop + viewport.height
        : window.innerHeight;
    if (!visibleBottom) return;

    const overflow = nav.getBoundingClientRect().bottom - visibleBottom;
    if (overflow > 1) {
        document.documentElement.style.setProperty(
            '--nav-viewport-lift',
            Math.ceil(overflow) + NAV_SAFE_GAP + 'px'
        );
    }
}

function scheduleBottomNavCheck(delay) {
    window.clearTimeout(navCheckTimer);
    navCheckTimer = window.setTimeout(keepBottomNavVisible, delay || 0);
}

window.addEventListener('pageshow', () => scheduleBottomNavCheck(0));
window.addEventListener('orientationchange', () => scheduleBottomNavCheck(150));
window.addEventListener('resize', () => {
    const active = document.activeElement;
    if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
    scheduleBottomNavCheck(100);
});
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleBottomNavCheck(0);
});

/* ==========================================================================
   App Bootstrap
   ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {

    // Load the stored language and translate the static markup before any
    // page module renders (t() is used throughout the app).
    await initI18n();

    initViewportZoomGuards();

    initMapListeners();

    initInstallPrompt();

    // The auth gate owns the claim/login/register panel. The backend decides
    // which mode applies; failures keep the app on its current (legacy/demo)
    // path instead of blocking it.
    const authPage = initAuthPage({ getActiveUserId });

    // Identity changes from the auth panel (login, claim, register, demo) or
    // from the Settings user-id field refresh the per-user UI/state.
    window.addEventListener('locateme:identity-changed', (event) => {
        const userId = event.detail && event.detail.userId ? event.detail.userId : '';
        updateDemoModeNote();
        silentBadgeSync(userId || getActiveUserId(), checkBackendStatus);
        resetLocatePage();
        const historyPage = document.getElementById('page-history');
        if (historyPage && !historyPage.classList.contains('hidden')) {
            showHistorySkeleton();
            fetchAndRenderHistory({ getActiveUserId, checkBackendStatus });
        }
    });

    initSettingsPage({
        onSave: (userId) => {
            // A new identity never inherits the previous account's token.
            clearSession();
            silentBadgeSync(userId, checkBackendStatus);
            updateDemoModeNote();
            authPage.evaluate();
        },
        getActiveUserId,
        onOpenAccount: () => authPage.open()
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

    // Tap the version in Settings: re-open the release notes on demand.
    const versionDisplay = document.getElementById('app-version-display');
    if (versionDisplay) {
        versionDisplay.addEventListener('click', openReleaseNotes);
    }

    // Trigger 1: Core Startup Sequence
    silentBadgeSync(getActiveUserId(), checkBackendStatus);
    checkBackendStatus();

    // One-time "What's new" after the app has launched at least once and no
    // install banner is competing for the user's attention. If the auth gate
    // opens (claim/login/register), skip it for this launch instead of
    // stacking two overlays; it will be shown on the next launch.
    authPage.evaluate().then((opened) => {
        if (!opened) maybeShowReleaseNotes();
    });

    // Check the bottom nav once layout has settled (Android PWA reload issue).
    keepBottomNavVisible();
    window.requestAnimationFrame(keepBottomNavVisible);
    scheduleBottomNavCheck(250);
});

// Trigger 3: Event-driven recovery when app moves back into foreground
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        checkBackendStatus();
    }
});

/* ==========================================================================
   Language switch: setLanguage() applies the static markup in place (no
   reload) and fires "i18n:languagechanged". Refresh the page-specific
   dynamic content so nothing keeps rendering in the previous language.
   ========================================================================== */
document.addEventListener('i18n:languagechanged', () => {
    checkBackendStatus();          // Settings backend-info + status title
    resetLocatePage();             // discard preview, rebuild dynamic strings
    invalidateHistoryI18n();       // filter bar + offline banner rebuild lazily

    const settingsStatus = document.getElementById('settings-status');
    if (settingsStatus) settingsStatus.innerText = '';
});

registerServiceWorker();