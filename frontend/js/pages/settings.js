/* ==========================================================================
   Page: Settings
   Verwaltet LocalStorage (userId), Password-Toggle und Save-Button.
   Abhängigkeiten kommen als Parameter rein – kein direkter Modulimport nötig.
   ========================================================================== */

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

    // --- LocalStorage: userId beim Start ins Feld laden ---
    const savedId = localStorage.getItem('userId');
    if (savedId) {
        document.getElementById('username-input').value = savedId;
    }

    // --- Save-Button ---
    document.getElementById('save-settings-btn').addEventListener('click', () => {
        const inputVal  = document.getElementById('username-input').value.trim();
        const statusDiv = document.getElementById('settings-status');

        localStorage.setItem('userId', inputVal);

        statusDiv.style.color = "#16a34a";
        statusDiv.innerText = "Settings saved successfully!";

        if (onSave) onSave(getActiveUserId());

        setTimeout(() => {
            statusDiv.innerText = "";
        }, 3000);
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