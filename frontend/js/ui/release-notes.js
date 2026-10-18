/* ==========================================================================
   locate.me – "What's new" release notes dialog
   Shows the app-local release notes once per APP_VERSION. A first-ever launch
   never shows the dialog, and an active install banner suppresses it so the
   first-run experience stays unambiguous.
   ========================================================================== */
import { t, getLanguage, getLocaleTag } from '../i18n.js';
import { RELEASE_NOTES } from '../release-notes.js';

const SEEN_KEY = 'locate-me.release-notes-seen-version';
const FIRST_LAUNCH_KEY = 'locate-me.first-launch-done';
const SHOW_DELAY_MS = 900;

const RELEASE_NOTES_URLS = {
    en: 'https://www.locate-me.net/release-notes.html',
    de: 'https://www.locate-me.net/release-notes.de.html',
    es: 'https://www.locate-me.net/release-notes.es.html',
    fr: 'https://www.locate-me.net/release-notes.html'
};

const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>';
const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"></path></svg>';

function readStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        /* storage unavailable – the dialog still works for this session */
    }
}

function getAppVersion() {
    return document.documentElement.dataset.appVersion || RELEASE_NOTES.version;
}

// Existing installations predate the first-launch marker. Any of these keys
// proves that the app has been used before, so they must not lose this release's
// notes just because the marker was introduced later.
function hasPriorUse() {
    const priorUseKeys = [
        'userId',
        'lang',
        'theme',
        'installBannerDismissed',
        'iosInstallHintDismissed'
    ];
    if (priorUseKeys.some(key => readStorage(key) !== null)) {
        return true;
    }
    try {
        return Object.keys(localStorage).some(key => key.startsWith('locate.me.lastFix.'));
    } catch (e) {
        return false;
    }
}

function formatReleaseDate(isoDate) {
    const parts = String(isoDate || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) {
        return isoDate || '';
    }
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return new Intl.DateTimeFormat(getLocaleTag(), {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(date);
}

function buildReleaseItem(item) {
    const row = document.createElement('li');
    row.className = 'release-notes-item';

    const icon = document.createElement('span');
    icon.className = 'release-notes-item-icon';
    icon.innerHTML = CHECK_ICON;

    const body = document.createElement('div');
    body.className = 'release-notes-item-body';

    const title = document.createElement('strong');
    title.textContent = item.title;

    const text = document.createElement('p');
    text.textContent = item.text;

    body.append(title, text);
    row.append(icon, body);
    return row;
}

function buildDialog(version) {
    const language = getLanguage();
    const content = RELEASE_NOTES[language] || RELEASE_NOTES.en;
    const websiteUrl = RELEASE_NOTES_URLS[language] || RELEASE_NOTES_URLS.en;

    const dialog = document.createElement('dialog');
    dialog.className = 'release-notes-dialog';
    dialog.setAttribute('aria-labelledby', 'release-notes-title');

    const panel = document.createElement('div');
    panel.className = 'release-notes-panel';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'release-notes-close';
    close.setAttribute('aria-label', t('releaseNotes.closeLabel'));
    close.innerHTML = CLOSE_ICON;
    close.addEventListener('click', () => dialog.close());

    const title = document.createElement('h2');
    title.id = 'release-notes-title';
    title.className = 'release-notes-eyebrow';
    title.textContent = t('releaseNotes.title');

    const meta = document.createElement('div');
    meta.className = 'release-notes-meta';

    const versionPill = document.createElement('span');
    versionPill.className = 'release-notes-version';
    versionPill.textContent = `v${version}`;

    const date = document.createElement('span');
    date.className = 'release-notes-date';
    date.textContent = formatReleaseDate(RELEASE_NOTES.date);

    meta.append(versionPill, date);

    const header = document.createElement('div');
    header.className = 'release-notes-header';
    header.append(title, meta);

    const tagline = document.createElement('p');
    tagline.className = 'release-notes-tagline';
    tagline.textContent = content.tagline;

    const list = document.createElement('ul');
    list.className = 'release-notes-list';
    content.items.forEach(item => list.appendChild(buildReleaseItem(item)));

    const body = document.createElement('div');
    body.className = 'release-notes-body';
    body.tabIndex = 0;
    body.append(tagline, list);

    const actions = document.createElement('div');
    actions.className = 'release-notes-actions';

    const websiteLink = document.createElement('a');
    websiteLink.className = 'release-notes-link';
    websiteLink.href = websiteUrl;
    websiteLink.target = '_blank';
    websiteLink.rel = 'noopener noreferrer';
    websiteLink.textContent = t('releaseNotes.viewAll');

    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'release-notes-done';
    done.textContent = t('releaseNotes.close');
    done.addEventListener('click', () => dialog.close());

    actions.append(websiteLink, done);
    panel.append(close, header, body, actions);
    dialog.appendChild(panel);

    // Clicking the backdrop (outside the panel) closes the dialog.
    dialog.addEventListener('click', event => {
        if (event.target === dialog) {
            dialog.close();
        }
    });
    dialog.addEventListener('close', () => dialog.remove());
    return dialog;
}

function showReleaseNotes(version) {
    const dialog = buildDialog(version);
    document.body.appendChild(dialog);
    dialog.showModal();
    writeStorage(SEEN_KEY, version);
}

export function maybeShowReleaseNotes() {
    const version = getAppVersion();

    // The first-ever launch belongs to onboarding/install, never to a changelog.
    // Existing users are recognised by their prior app state and may see the
    // notes immediately when the feature is introduced.
    if (readStorage(FIRST_LAUNCH_KEY) === null) {
        const priorUse = hasPriorUse();
        writeStorage(FIRST_LAUNCH_KEY, '1');
        if (!priorUse) {
            return;
        }
    }

    if (readStorage(SEEN_KEY) === version) {
        return;
    }

    // Give a possible install banner a moment to appear before competing with it.
    window.setTimeout(() => {
        if (readStorage(SEEN_KEY) === version) return;
        if (document.querySelector('dialog[open]')) return;
        if (document.querySelector('.install-banner--visible')) return;
        showReleaseNotes(version);
    }, SHOW_DELAY_MS);
}
