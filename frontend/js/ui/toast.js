/* ==========================================================================
   Status Toast Notification
   Zeigt einen temporären Online/Offline-Hinweis am oberen Bildschirmrand.
   ========================================================================== */
export function showStatusToast(state) {
    // Remove any existing toast to avoid stacking
    const existing = document.getElementById('status-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'status-toast';
    toast.className = `status-toast status-toast--${state}`;
    toast.textContent = state === 'online' ? '✓ Backend online' : '✗ Backend not reachable';

    document.querySelector('.app-container').appendChild(toast);

    // Trigger reflow to enable CSS transition
    toast.getBoundingClientRect();
    toast.classList.add('status-toast--visible');

    const duration = state === 'online' ? 2000 : 3000;
    setTimeout(() => {
        toast.classList.remove('status-toast--visible');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}