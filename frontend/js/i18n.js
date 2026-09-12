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
   Public: bootstrap – load the stored language + English fallback, then
   translate the static markup. Never throws: on failure the app falls back to
   English / raw keys so it stays usable.
   ========================================================================== */
export async function initI18n() {
    currentLanguage = normalizeLanguage(localStorage.getItem('lang') || DEFAULT_LANGUAGE);

    const [fallback, selected] = await Promise.all([
        fetchLocale(DEFAULT_LANGUAGE).catch(() => ({})),
        currentLanguage === DEFAULT_LANGUAGE
            ? Promise.resolve(null)
            : fetchLocale(currentLanguage).catch(() => null)
    ]);

    fallbackStrings = fallback || {};
    currentStrings = selected || fallbackStrings;

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
   Public: persist a new language and reload so every rendered string is
   re-translated from a clean boot.
   ========================================================================== */
export function setLanguage(lang) {
    const next = normalizeLanguage(lang);
    localStorage.setItem('lang', next);
    if (next === currentLanguage) return;
    window.location.reload();
}
