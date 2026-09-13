/* ==========================================================================
   locate.me – Lightweight Internationalization (i18n)
   No framework: flat-key JSON dictionaries under ./locales/, loaded on demand.
   - Default language is English; any missing key falls back to English,
     then to the key itself.
   - The selected language is persisted in localStorage ("lang") and applied
     by reloading the page (setLanguage).
   - Static markup is translated via data-i18n* attributes (applyTranslations);
     dynamic strings use t(key, params).
   ========================================================================== */

const DEFAULT_LANGUAGE = 'en';
const SUPPORTED_LANGUAGES = ['en', 'de', 'es'];

/* BCP-47 tags for Intl/toLocaleString date & number formatting. */
const LOCALE_TAGS = {
    en: 'en-GB',
    de: 'de-DE',
    es: 'es-ES'
};

let currentLanguage = DEFAULT_LANGUAGE;
let currentStrings = {};
let fallbackStrings = {};

function normalizeLanguage(lang) {
    return SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
}

/* ==========================================================================
   Internal: best-effort language detection from the browser.
   Walks navigator.languages (fallback navigator.language), reduces each tag
   to its primary subtag (e.g. "de-AT" -> "de") and returns the first
   supported match. English is the fallback. The detected value is NOT
   persisted – only an explicit setLanguage() choice is stored, so a user
   selection always wins and is never overwritten.
   ========================================================================== */
function detectBrowserLanguage() {
    const tags = (Array.isArray(navigator.languages) && navigator.languages.length)
        ? navigator.languages
        : [navigator.language];

    for (const tag of tags) {
        const primary = String(tag || '').toLowerCase().split('-')[0];
        if (SUPPORTED_LANGUAGES.includes(primary)) return primary;
    }
    return DEFAULT_LANGUAGE;
}

/* ==========================================================================
   Public: current language / locale tag
   ========================================================================== */
export function getLanguage() {
    return currentLanguage;
}

export function getLocaleTag() {
    return LOCALE_TAGS[currentLanguage] || LOCALE_TAGS[DEFAULT_LANGUAGE];
}

/* ==========================================================================
   Public: translate a key, optionally substituting {placeholders}.
   Falls back to English, then to the key itself.
   ========================================================================== */
export function t(key, params = null) {
    if (key === undefined || key === null) return '';

    let value = currentStrings[key];
    if (value === undefined) value = fallbackStrings[key];
    if (value === undefined) return key;

    if (params) {
        value = value.replace(/\{(\w+)\}/g, (match, name) =>
            Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
    }
    return value;
}

/* ==========================================================================
   Internal: fetch a locale JSON file
   ========================================================================== */
async function fetchLocale(lang) {
    const response = await fetch(`./locales/${lang}.json`);
    if (!response.ok) throw new Error(`Locale "${lang}" could not be loaded`);
    return response.json();
}

/* ==========================================================================
   Internal: load the English fallback + the requested language into memory.
   A request token guards against out-of-order responses when the language is
   changed again before the previous load finished. Never throws (fetch
   failures fall back to empty/previous dictionaries).
   Returns true when this call was the latest one and applied its result.
   ========================================================================== */
let loadToken = 0;

async function loadDictionaries(lang) {
    const token = ++loadToken;

    const [fallback, selected] = await Promise.all([
        fetchLocale(DEFAULT_LANGUAGE).catch(() => fallbackStrings || {}),
        lang === DEFAULT_LANGUAGE
            ? Promise.resolve(null)
            : fetchLocale(lang).catch(() => null)
    ]);

    if (token !== loadToken) return false; // a newer load superseded this one

    fallbackStrings = fallback || {};
    currentStrings = selected || fallbackStrings;
    currentLanguage = lang;
    return true;
}

/* ==========================================================================
   Public: bootstrap – load the stored language (or, on a first visit without
   a stored preference, the detected browser language) + English fallback,
   then translate the static markup.
   ========================================================================== */
export async function initI18n() {
    const stored = localStorage.getItem('lang');
    const lang = stored ? normalizeLanguage(stored) : detectBrowserLanguage();
    await loadDictionaries(lang);

    try {
        applyTranslations();
    } finally {
        document.documentElement.classList.remove('i18n-loading');
    }
    return currentLanguage;
}

/* ==========================================================================
   Public: translate the static markup.
   Supported attributes:
     data-i18n              -> textContent
     data-i18n-placeholder  -> placeholder
     data-i18n-title        -> title
     data-i18n-aria-label   -> aria-label
   ========================================================================== */
export function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
    document.documentElement.lang = currentLanguage;
}

/* ==========================================================================
   Public: persist a new language and apply it in place (no page reload).
   Reloading a standalone PWA leaves the mobile viewport mis-measured (the
   bottom navigation got clipped until the app was killed), so the static
   markup is re-translated and an "i18n:languagechanged" event is dispatched
   so page modules can re-render their dynamic content.
   ========================================================================== */
export async function setLanguage(lang) {
    const next = normalizeLanguage(lang);
    if (next === currentLanguage) return next;

    localStorage.setItem('lang', next);

    const applied = await loadDictionaries(next);
    if (!applied) return currentLanguage; // superseded by a newer request

    applyTranslations();
    document.dispatchEvent(new Event('i18n:languagechanged'));
    return next;
}
