import { t } from '../i18n.js';

/* ==========================================================================
   PWA Install Prompt
   Chrome/Brave (Android) no longer show a native install banner on their own;
   the only browser-provided hook is the "beforeinstallprompt" event. This
   module turns that event into a dismissible top-of-screen banner whose
   Install button opens the native install dialog. iOS Safari never fires the
   event, so a one-time "Add to Home Screen" hint is shown instead.
   ========================================================================== */

const DISMISS_KEY = 'installBannerDismissed';
const IOS_DISMISS_KEY = 'iosInstallHintDismissed';

const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>';
const SHARE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"></path><path d="M8 7l4-4 4 4"></path><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"></path></svg>';

let deferredPrompt = null;
let bannerEl = null;
let bannerTitleEl = null;
let bannerTextEl = null;
let bannerActionEl = null;
let bannerCloseEl = null;
let iosEl = null;
let iosTitleEl = null;
let iosBodyEl = null;
let iosCloseEl = null;

function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        navigator.standalone === true;
}

function isIosSafari() {
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return ios && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

function getContainer() {
    return document.querySelector('.app-container') || document.body;
}

function showElement(el) {
    if (!el) return;
    if (el.parentElement !== getContainer()) getContainer().appendChild(el);
    el.getBoundingClientRect();
    el.classList.add('install-banner--visible');
}

function hideElement(el, persistKey) {
    if (!el) return;
    el.classList.remove('install-banner--visible');
    if (persistKey) localStorage.setItem(persistKey, '1');
}

function applyBannerText() {
    if (bannerTitleEl) bannerTitleEl.textContent = t('install.androidTitle');
    if (bannerTextEl) bannerTextEl.textContent = t('install.androidText');
    if (bannerActionEl) bannerActionEl.textContent = t('install.install');
    if (bannerCloseEl) bannerCloseEl.setAttribute('aria-label', t('install.dismiss'));
    if (iosTitleEl) iosTitleEl.textContent = t('install.iosTitle');
    if (iosBodyEl) iosBodyEl.textContent = t('install.iosText');
    if (iosCloseEl) iosCloseEl.setAttribute('aria-label', t('install.dismiss'));
}

function createTextBlock() {
    const text = document.createElement('div');
    text.className = 'install-banner-text';
    const title = document.createElement('span');
    title.className = 'install-banner-title';
    const body = document.createElement('span');
    body.className = 'install-banner-text-body';
    text.append(title, body);
    return { text, title, body };
}

function createCloseButton(onClick) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'install-banner-close';
    close.innerHTML = CLOSE_ICON;
    close.addEventListener('click', onClick);
    return close;
}

function createBanner() {
    bannerEl = document.createElement('div');
    bannerEl.id = 'install-banner';
    bannerEl.className = 'install-banner';
    bannerEl.setAttribute('role', 'dialog');
    bannerEl.setAttribute('aria-live', 'polite');

    const icon = document.createElement('img');
    icon.className = 'install-banner-icon';
    icon.src = 'icons/icon_192.png';
    icon.alt = '';

    const { text, title, body } = createTextBlock();
    bannerTitleEl = title;
    bannerTextEl = body;

    bannerActionEl = document.createElement('button');
    bannerActionEl.type = 'button';
    bannerActionEl.className = 'install-banner-action';
    bannerActionEl.addEventListener('click', onInstallClick);

    bannerCloseEl = createCloseButton(() => hideBanner(true));

    bannerEl.append(icon, text, bannerActionEl, bannerCloseEl);
    applyBannerText();
    return bannerEl;
}

function createIosHint() {
    iosEl = document.createElement('div');
    iosEl.id = 'ios-install-hint';
    iosEl.className = 'install-banner install-banner--ios';
    iosEl.setAttribute('role', 'dialog');
    iosEl.setAttribute('aria-live', 'polite');

    const icon = document.createElement('span');
    icon.className = 'install-banner-icon install-banner-share';
    icon.innerHTML = SHARE_ICON;

    const { text, title, body } = createTextBlock();
    iosTitleEl = title;
    iosBodyEl = body;

    iosCloseEl = createCloseButton(() => hideElement(iosEl, IOS_DISMISS_KEY));

    iosEl.append(icon, text, iosCloseEl);
    applyBannerText();
    return iosEl;
}

async function onInstallClick() {
    if (!deferredPrompt) {
        hideBanner(false);
        return;
    }
    hideBanner(false);
    deferredPrompt.prompt();
    try {
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') localStorage.setItem(DISMISS_KEY, '1');
    } catch (err) {
        // prompt() can only be called once; ignore stale deferred events
    }
    deferredPrompt = null;
    window.__bipEvent = null;
}

function showBanner() {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY) === '1') return;
    if (!bannerEl) bannerEl = createBanner();
    showElement(bannerEl);
}

function hideBanner(persist) {
    hideElement(bannerEl, persist ? DISMISS_KEY : null);
}

function showIosHint() {
    if (!isIosSafari() || isStandalone() || localStorage.getItem(IOS_DISMISS_KEY) === '1') return;
    if (!iosEl) iosEl = createIosHint();
    showElement(iosEl);
}

export function initInstallPrompt() {
    window.addEventListener('locateme:installavailable', () => {
        deferredPrompt = window.__bipEvent || deferredPrompt;
        if (deferredPrompt) showBanner();
    });

    window.addEventListener('locateme:installed', () => {
        deferredPrompt = null;
        hideBanner(true);
    });

    // Fallback capture in case the inline head script was stripped.
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        window.__bipEvent = e;
        showBanner();
    });

    document.addEventListener('i18n:languagechanged', applyBannerText);

    if (window.__bipEvent) {
        deferredPrompt = window.__bipEvent;
        showBanner();
    } else {
        showIosHint();
    }
}
