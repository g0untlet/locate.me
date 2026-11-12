import { t, getLanguage, setLanguage } from '../i18n.js';

/* ==========================================================================
   Page: Settings
   Verwaltet LocalStorage (userId), Password-Toggle und die automatische
   Speicherung der User-ID. Abhängigkeiten kommen als Parameter rein – kein
   direkter Modulimport nötig.
   ========================================================================== */

/* Mirrors the backend check in PositionsResource: alphanumeric, at most 16
   characters. Validated inline so a typo cannot silently switch every request
   to an unknown user. */
const USER_ID_PATTERN   = /^[A-Za-z0-9]{1,16}$/;
const SAVE_DEBOUNCE_MS  = 600;
const STATUS_VISIBLE_MS = 2000;

/* ==========================================================================
   Request-UserId-Link: info@locate-me.net – als Char-Codes gespeichert, um
   Crawlern die eMail-Adresse vorzuenthalten. Wird erst zur Laufzeit dekodiert.
   ========================================================================== */
function initRequestUserIdLink() {
    const codes = [105,110,102,111,64,108,111,99,97,116,101,45,109,101,46,110,101,116];
    const link  = document.getElementById('request-user-id-link');
    if (link) link.href = 'mailto:' + codes.map(c => String.fromCharCode(c)).join('');
}

export function initSettingsPage({ onSave, getActiveUserId }) {

    initRequestUserIdLink();

    // --- Dark-Mode-Toggle --- 
    const darkToggle = document.getElementById('dark-mode-toggle'); 
    darkToggle.setAttribute('aria-checked', document.documentElement.dataset.theme === 'dark');

    darkToggle.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        localStorage.setItem('theme', next);
        darkToggle.setAttribute('aria-checked', next === 'dark');
    });

    // --- Language selector: aktuelle Sprache setzen, Wechsel persistiert + reload ---
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
        languageSelect.value = getLanguage();
        languageSelect.addEventListener('change', () => setLanguage(languageSelect.value));
    }

    // --- LocalStorage: userId beim Start ins Feld laden ---
    const savedId = localStorage.getItem('userId');
    if (savedId) {
        document.getElementById('username-input').value = savedId;
    }

    // --- User-ID: saved automatically (no Save button) -----------------------
    // The button only ever wrote this one value — theme and language already
    // persist on interaction. The field now saves itself: shortly after typing,
    // when leaving the field, on Enter and when the app is hidden. A blank value
    // keeps meaning "demo user123", exactly as before.
    const idInput   = document.getElementById('username-input');
    const statusDiv = document.getElementById('settings-status');
    let saveTimer   = null;
    let statusTimer = null;

    function showStatus(key, isError) {
        clearTimeout(statusTimer);
        statusDiv.textContent = key ? t(key) : '';
        statusDiv.classList.toggle('settings-status--ok', Boolean(key) && !isError);
        statusDiv.classList.toggle('settings-status--error', Boolean(key) && isError);
        if (key) statusTimer = setTimeout(() => showStatus(null), STATUS_VISIBLE_MS);
    }

    function persistUserId() {
        clearTimeout(saveTimer);
        saveTimer = null;
        const value = idInput.value.trim();
        if (value !== '' && !USER_ID_PATTERN.test(value)) {
            // The previously stored id stays active, so a typo never breaks
            // requests silently — the user just sees this hint.
            showStatus('settings.invalidUserId', true);
            return;
        }
        if (value === (localStorage.getItem('userId') || '').trim()) return;
        localStorage.setItem('userId', value);
        if (onSave) onSave(getActiveUserId());
        showStatus('settings.saved', false);
    }

    idInput.addEventListener('input', () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(persistUserId, SAVE_DEBOUNCE_MS);
        // The value changed again — a "saved" confirmation no longer applies.
        if (statusDiv.classList.contains('settings-status--ok')) showStatus(null);
    });
    idInput.addEventListener('blur', persistUserId);
    idInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        persistUserId();
        idInput.blur();
    });
    // Closing the PWA or switching apps never blurs the field on all platforms.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') persistUserId();
    });

    // --- Password-Toggle (Eye-Icon) ---
    const togglePasswordBtn = document.getElementById('toggle-password-btn');
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const usernameInput = document.getElementById('username-input');
            const eyeVisible    = document.getElementById('eye-icon-visible');
            const eyeHidden     = document.getElementById('eye-icon-hidden');

            if (!usernameInput) return;

            if (usernameInput.type === 'password') {
                usernameInput.type = 'text';
                eyeVisible.classList.add('hidden');
                eyeHidden.classList.remove('hidden');
            } else {
                usernameInput.type = 'password';
                eyeVisible.classList.remove('hidden');
                eyeHidden.classList.add('hidden');
            }
        });
    }
}