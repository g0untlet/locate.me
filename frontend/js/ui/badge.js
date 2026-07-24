import { apiGetPositions } from '../api.js';

/* ==========================================================================
   History Badge State Controller
   ========================================================================== */
export function updateHistoryBadge(count) {
    const badge = document.getElementById('history-badge');
    if (!badge) return;

    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

/* ==========================================================================
   Background Silent Badge Sync (für Startup und nach Settings-Speichern)
   onError-Callback verhindert zirkuläre Abhängigkeit zu status.js –
   der Aufrufer entscheidet, was bei einem Sync-Fehler passiert.
   ========================================================================== */
export function silentBadgeSync(userId, onError) {
    apiGetPositions(userId)
        .then(data => {
            if (Array.isArray(data)) {
                updateHistoryBadge(data.length);
            }
        })
        .catch(() => {
            console.log("Silent badge sync paused. Offline or server unreachable.");
            if (onError) onError();
        });
}