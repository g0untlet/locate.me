import { apiGetSystemInfo } from '../api.js';
import { showStatusToast } from './toast.js';
import { t, getLocaleTag } from '../i18n.js';

/* ==========================================================================
   Backend Info Renderer (Settings-Seite)
   ========================================================================== */
function renderBackendInfo(info) {
    const el = document.getElementById('backend-info');
    if (!el) return;

    if (!info) {
        el.innerHTML = `
            <div class="attribution-links">
                <span class="attribution-link attribution-link--offline">${t('settings.backendNotReachable')}</span>
            </div>`;
        return;
    }

    let onlineSince = '–';
    if (info.startupTime) {
        const d = new Date(info.startupTime);
        if (!isNaN(d.getTime())) {
            onlineSince = d.toLocaleString(getLocaleTag(), {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }
    }

    el.innerHTML = `
        <div class="attribution-links">
            <span class="attribution-link">${info.artifactId || '–'} ${info.version || ''}</span>
            <span class="attribution-link">${t('settings.onlineSince', { date: onlineSince })}</span>
        </div>`;
}

/* ==========================================================================
   Backend Health Check & Status-Dot Controller
   ========================================================================== */
export async function checkBackendStatus(showToast = false) {
    const statusDot = document.querySelector('.status-dot');
    if (!statusDot) return;

    try {
        const info = await apiGetSystemInfo();
        statusDot.classList.remove('offline');
        statusDot.classList.add('online');
        statusDot.parentElement.title = t('header.applicationOnline');
        if (showToast) showStatusToast('online');
        renderBackendInfo(info);
    } catch (error) {
        // A 429 (rate limit) means the backend is up, just throttled – keep the
        // status dot online instead of falsely reporting it as offline.
        if (error && error.status === 429) {
            statusDot.classList.remove('offline');
            statusDot.classList.add('online');
            statusDot.parentElement.title = t('header.applicationOnline');
            return;
        }
        statusDot.classList.remove('online');
        statusDot.classList.add('offline');
        statusDot.parentElement.title = t('header.backendUnreachable');
        if (showToast) showStatusToast('offline');
        renderBackendInfo(null);
    }
}

/* ==========================================================================
   Locate Page: Inline Error Display
   ========================================================================== */
export function showError(message) {
    const statusText = document.getElementById('status');
    statusText.innerText = message;
    statusText.className = "status-error";
}