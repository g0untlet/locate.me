/* ==========================================================================
   locate.me website – main.js
   Handles the light/dark theme toggle.
   (Language switching uses plain links between the language pages – no JS.)
   ========================================================================== */
(function () {
    var root = document.documentElement;

    function getInitialTheme() {
        try {
            var stored = localStorage.getItem('theme');
            return stored === 'dark' || stored === 'light' ? stored : 'light';
        } catch (e) {
            return 'light';
        }
    }

    function applyTheme(theme) {
        root.dataset.theme = theme;
        var toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.setAttribute('aria-checked', String(theme === 'dark'));
        }
    }

    applyTheme(getInitialTheme());

    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.addEventListener('click', function () {
            var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            try {
                localStorage.setItem('theme', next);
            } catch (e) {
                /* storage unavailable – theme still applies for this page view */
            }
        });
    }

    var emailUser = 'in' + 'fo';
    var emailDomain = 'locate' + '-me.net';
    var emailLinks = document.querySelectorAll('.email-link');
    for (var i = 0; i < emailLinks.length; i++) {
        emailLinks[i].setAttribute('href', 'mailto:' + emailUser + '@' + emailDomain);
    }
})();