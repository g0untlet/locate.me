import { apiGetSystemInfo } from '../api.js';
import { showStatusToast } from './toast.js';

/* ==========================================================================
   Backend Info Renderer (Settings-Seite)
   ========================================================================== */
function renderBackendInfo(info) {
    const el = document.getElementById('backend-info');
    if (!el) return;

    if (!info) {
        el.innerHTML = `<span class="backend-info-label">BACKEND</span>
                        <span class="backend-info-value backend-info-offline">Not reachable</span>`;
        return;
    }

    let onlineSince = '–';
    if (info.startupTime) {
        const d = new Date(info.startupTime);
        if (!isNaN(d.getTime())) {
            onlineSince = d.toLocaleString('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }
    }

    el.innerHTML = `<span class="backend-info-label">BACKEND</span>
                    <span class="backend-info-value">${info.artifactId || '–'} ${info.version || ''}</span>
                    <span class="backend-info-since">Online since ${onlineSince}</span>`;
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
        statusDot.parentElement.title = "Application Online";
        if (showToast) showStatusToast('online');
        renderBackendInfo(info);
    } catch (error) {
        statusDot.classList.remove('online');
        statusDot.classList.add('offline');
        statusDot.parentElement.title = "Backend unreachable";
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