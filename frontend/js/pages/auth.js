/* ==========================================================================
   Page: authentication gate
   One-time legacy claim, login, self-registration and the shared demo path.
   The gate only blocks after a positive backend answer: a user with an
   unmigrated id is offered the claim, an already migrated/registered id the
   login, an unknown id the login (which can switch to registration), and the
   demo never sees a prompt. While the backend still allows the legacy
   ?userId= path, "Not now" keeps the app exactly as before.
   ========================================================================== */
import { t } from '../i18n.js';
import { apiClaim, apiLogin, apiMigrationStatus, apiRegister } from '../api.js';
import { clearSession, readSession, saveSession } from '../auth.js';

const DEMO_USER_ID = 'user123';
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 32;
const PASSWORD_MAX_BYTES = 72;
const NAME_MAX = 128;
const EMAIL_MAX = 254;
const RESERVED = new Set([
    'user123', 'admin', 'administrator', 'root', 'system', 'api', 'null', 'undefined'
]);

let deps = null;
let el = null;
let mode = 'login';
let currentUserId = '';
let busy = false;
let dismissible = false;
let returnMode = 'login';

/* ==========================================================================
   Public: wire the panel. Returns { evaluate, open } for the bootstrap and
   the Settings entry point.
   ========================================================================== */
export function initAuthPage(dependencies) {
    deps = dependencies;

    el = {
        gate: document.getElementById('auth-gate'),
        title: document.getElementById('auth-title'),
        intro: document.getElementById('auth-intro'),
        form: document.getElementById('auth-form'),
        userId: document.getElementById('auth-userid'),
        userIdHelp: document.getElementById('auth-userid-help'),
        nameGroup: document.getElementById('auth-name-group'),
        name: document.getElementById('auth-name'),
        password: document.getElementById('auth-password'),
        passwordToggle: document.getElementById('auth-password-toggle'),
        passwordEye: document.getElementById('auth-password-eye'),
        passwordEyeOff: document.getElementById('auth-password-eye-off'),
        password2Group: document.getElementById('auth-password2-group'),
        password2: document.getElementById('auth-password2'),
        password2Toggle: document.getElementById('auth-password2-toggle'),
        password2Eye: document.getElementById('auth-password2-eye'),
        password2EyeOff: document.getElementById('auth-password2-eye-off'),
        emailGroup: document.getElementById('auth-email-group'),
        email: document.getElementById('auth-email'),
        status: document.getElementById('auth-status'),
        submit: document.getElementById('auth-submit'),
        secondary: document.getElementById('auth-secondary'),
        demo: document.getElementById('auth-demo'),
        later: document.getElementById('auth-later')
    };

    if (!el.gate || !el.form) {
        // A stale cached index.html without the panel: never break the app.
        return { evaluate: async () => false, open: () => { } };
    }

    el.form.addEventListener('submit', onSubmit);
    el.secondary.addEventListener('click', onSecondary);
    el.demo.addEventListener('click', useDemo);
    el.later.addEventListener('click', hide);
    wirePasswordToggle(el.password, el.passwordToggle, el.passwordEye, el.passwordEyeOff);
    wirePasswordToggle(el.password2, el.password2Toggle, el.password2Eye, el.password2EyeOff);
    window.addEventListener('locateme:session-expired', onSessionExpired);

    return {
        evaluate,
        // Settings entry point: force the panel even in demo mode / with a
        // valid session, so an account can be created or switched.
        open: () => { evaluate({ force: true }); }
    };
}

/* ==========================================================================
   Startup gate. Returns true when the panel was opened, so the bootstrap can
   suppress the "What's new" dialog for this launch instead of stacking two
   overlays. Failures (offline, 429) leave the app on its current path.
   ========================================================================== */
async function evaluate({ force = false } = {}) {
    const userId = deps.getActiveUserId();

    if (!force && readSession()) {
        return false;
    }
    if (userId === DEMO_USER_ID) {
        if (force) {
            open('login', { userId: '' });
            return true;
        }
        return false;
    }

    try {
        const status = await apiMigrationStatus(userId);
        if (status && status.migrationRequired) {
            open('claim', { userId });
        } else {
            open('login', { userId });
        }
        return true;
    } catch (e) {
        // Offline or throttled: do not block the app; retry on the next launch
        // and let the legacy/demo path (or the existing token) carry on.
        return false;
    }
}

/* ==========================================================================
   Internal: open the panel in a given mode.
   ========================================================================== */
function open(nextMode, { userId = '', message = '' } = {}) {
    if (!el || !el.gate) return;

    mode = nextMode;
    currentUserId = userId || '';
    // "Not now" is always valid for a claim (the legacy path still works).
    // Login/register can be dismissed when the user already has a valid
    // session (opened from Settings) — there is nothing to fix.
    dismissible = nextMode === 'claim' || readSession() !== null;
    el.form.reset();
    resetPasswordVisibility();
    el.userId.value = currentUserId;
    el.gate.classList.remove('hidden');
    setStatus(message, null);
    configureMode();
}

function configureMode() {
    const isClaim = mode === 'claim';
    const isRegister = mode === 'register';
    const needsNewPassword = isClaim || isRegister;

    el.userId.readOnly = isClaim;
    el.userId.classList.toggle('settings-input--readonly', isClaim);
    el.userIdHelp.classList.toggle('hidden', !isRegister);
    // The optional display name is collected during the one-time claim too.
    el.nameGroup.classList.toggle('hidden', !(isClaim || isRegister));
    el.password2Group.classList.toggle('hidden', !needsNewPassword);
    el.emailGroup.classList.toggle('hidden', !needsNewPassword);
    el.later.classList.toggle('hidden', !dismissible);
    el.later.textContent = isClaim ? t('auth.notNow') : t('auth.close');

    el.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';

    if (isClaim) {
        el.title.textContent = t('auth.claimTitle');
        el.intro.textContent = t('auth.claimIntro', { userId: currentUserId });
    } else if (isRegister) {
        el.title.textContent = t('auth.registerTitle');
        el.intro.textContent = t('auth.registerIntro');
    } else {
        el.title.textContent = t('auth.loginTitle');
        el.intro.textContent = currentUserId
            ? t('auth.loginIntro', { userId: currentUserId })
            : t('auth.loginIntroNew');
    }

    const submitKey = isClaim ? 'auth.submitClaim'
        : isRegister ? 'auth.submitRegister' : 'auth.submitLogin';
    el.submit.dataset.labelKey = submitKey;
    el.submit.textContent = t(submitKey);

    el.secondary.textContent = isRegister
        ? (returnMode === 'claim' ? t('auth.back') : t('auth.backToLogin'))
        : t('auth.createAccount');
    el.demo.textContent = t('auth.useDemo');
}

function hide() {
    if (!el || !el.gate || el.gate.classList.contains('hidden')) return;
    el.gate.classList.add('hidden');
    el.form.reset();
    resetPasswordVisibility();
    el.userId.value = '';
    currentUserId = '';
    setStatus('', null);
    // Let the bootstrap show the "What's new" dialog now that the panel is
    // gone (it is suppressed while the gate is open to avoid stacking two
    // overlays, but existing users should still see why the account matters).
    window.dispatchEvent(new Event('locateme:auth-gate-closed'));
}

/* ==========================================================================
   Internal: password visibility toggles (eye icon), one per password field.
   Visibility is reset whenever the panel opens or closes, so a password is
   never left in clear text on screen.
   ========================================================================== */
function wirePasswordToggle(input, button, eye, eyeOff) {
    if (!input || !button) return;
    button.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        if (eye) eye.classList.toggle('hidden', show);
        if (eyeOff) eyeOff.classList.toggle('hidden', !show);
    });
}

function resetPasswordVisibility() {
    [[el.password, el.passwordEye, el.passwordEyeOff],
     [el.password2, el.password2Eye, el.password2EyeOff]].forEach(([input, eye, eyeOff]) => {
        if (!input) return;
        input.type = 'password';
        if (eye) eye.classList.remove('hidden');
        if (eyeOff) eyeOff.classList.add('hidden');
    });
}

/* ==========================================================================
   Internal: form actions
   ========================================================================== */
function onSecondary() {
    if (mode === 'register') {
        if (returnMode === 'claim') {
            open('claim', { userId: currentUserId });
        } else {
            open('login', { userId: el.userId.value.trim() || currentUserId });
        }
        return;
    }

    returnMode = mode;
    // From an unmigrated legacy id or from an already signed-in account the
    // user wants a *new* account, not the existing one; from a failed login the
    // typed id is a useful prefill.
    open('register', {
        userId: mode === 'claim' || readSession() ? '' : (el.userId.value.trim() || currentUserId)
    });
}

function useDemo() {
    clearSession();
    try {
        localStorage.setItem('userId', '');
    } catch (e) {
        /* storage unavailable – getActiveUserId falls back to the demo id */
    }
    window.dispatchEvent(new CustomEvent('locateme:identity-changed', { detail: { userId: '' } }));
    hide();
}

function onSessionExpired() {
    if (!el || !el.gate || !el.gate.classList.contains('hidden')) return;
    open('login', { userId: deps.getActiveUserId(), message: t('auth.sessionExpired') });
}

async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const input = {
        userId: el.userId.value.trim(),
        name: el.name.value.trim(),
        password: el.password.value,
        password2: el.password2.value,
        email: el.email.value.trim()
    };

    const problem = validate(input);
    if (problem) {
        setStatus(problem, 'error');
        return;
    }

    setBusy(true);
    try {
        const result = mode === 'claim'
            ? await apiClaim({
                userId: currentUserId,
                name: input.name || undefined,
                password: input.password,
                passwordConfirmation: input.password2,
                email: input.email
            })
            : mode === 'register'
                ? await apiRegister({
                    userId: input.userId,
                    name: input.name || undefined,
                    password: input.password,
                    passwordConfirmation: input.password2,
                    email: input.email
                })
                : await apiLogin({ userId: input.userId, password: input.password });

        completeAuthentication(result);
    } catch (error) {
        setStatus(errorMessage(error), 'error');
    } finally {
        setBusy(false);
    }
}

function completeAuthentication(result) {
    if (!result || !result.token || !result.userId || !result.expiresAt) {
        setStatus(t('auth.errorGeneric'), 'error');
        return;
    }

    // Set the active identity first: readSession() only accepts a session for
    // the current userId.
    try {
        localStorage.setItem('userId', result.userId);
    } catch (e) {
        /* storage unavailable – the session below will not persist either */
    }
    saveSession({
        token: result.token,
        userId: result.userId,
        expiresAt: result.expiresAt
    });
    window.dispatchEvent(new CustomEvent('locateme:identity-changed', {
        detail: { userId: result.userId }
    }));
    hide();
}

/* ==========================================================================
   Internal: validation + error messages
   ========================================================================== */
function validate(input) {
    if (mode === 'login') {
        if (!input.userId) return t('auth.enterUserId');
        if (!input.password) return t('auth.enterPassword');
        return null;
    }

    if (mode === 'register') {
        if (!USER_ID_PATTERN.test(input.userId)) return t('auth.errorInvalidUserId');
        if (RESERVED.has(input.userId.toLowerCase())) return t('auth.errorUserIdReserved');
    }

    if (!input.password
        || input.password.length < PASSWORD_MIN
        || input.password.length > PASSWORD_MAX
        || new TextEncoder().encode(input.password).length > PASSWORD_MAX_BYTES) {
        return t('auth.errorInvalidPassword');
    }
    if (input.password !== input.password2) {
        return t('auth.errorPasswordsDiffer');
    }
    if (!EMAIL_PATTERN.test(input.email) || input.email.length > EMAIL_MAX) {
        return t('auth.errorInvalidEmail');
    }
    if (input.name && input.name.length > NAME_MAX) {
        return t('auth.errorInvalidInput');
    }
    return null;
}

function errorMessage(error) {
    if (!error || !error.status) return t('auth.errorNetwork');
    if (error.status === 429) return rateLimitMessage(error.retryAfter);

    if (mode === 'login' && error.status === 401) return t('auth.errorInvalidCredentials');
    if (mode === 'register' && error.status === 409) return t('auth.errorUserTaken');

    if (mode === 'claim') {
        if (error.status === 404) return t('auth.errorUnknownUser');
        if (error.status === 409) return t('auth.errorClaimConflict');
        if (error.status === 403) return t('auth.errorDemo');
        if (error.status === 503) return t('auth.errorClaimUnavailable');
    }

    if (error.status === 400) return t('auth.errorInvalidInput');
    if (error.status === 401) return t('auth.errorInvalidCredentials');
    return t('auth.errorGeneric');
}

function rateLimitMessage(retryAfter) {
    if (!Number.isFinite(retryAfter) || retryAfter <= 0) {
        return t('errors.tooManyRequests');
    }
    if (retryAfter < 60) {
        return t('auth.errorRateLimitedSeconds', { seconds: Math.ceil(retryAfter) });
    }
    return t('auth.errorRateLimitedMinutes', { minutes: Math.ceil(retryAfter / 60) });
}

function setStatus(text, kind) {
    if (!el || !el.status) return;
    el.status.textContent = text || '';
    el.status.classList.toggle('settings-status--error', kind === 'error');
    el.status.classList.toggle('settings-status--ok', kind === 'ok');
}

function setBusy(value) {
    busy = value;
    if (!el || !el.submit) return;
    el.submit.disabled = value;
    el.submit.textContent = value
        ? t('auth.working')
        : t(el.submit.dataset.labelKey || 'auth.submitLogin');
}
