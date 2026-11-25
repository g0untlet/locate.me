/* ==========================================================================
   locate.me – App-local release notes
   Compact, app-specific notes for the "What's new" dialog. The static website
   remains the full release archive; this file contains only the latest release
   in all app languages. Unsupported languages fall back to English in the UI.
   Update this file together with the website notes and the APP_VERSION bump
   (and refresh the app.js/style.css cache-busters) for every release.
   Keep the dialog short: one short tagline and at most five one-sentence
   bullets — long notes are simply not read.
   ========================================================================== */

export const RELEASE_NOTES = {
    version: '0.5.0_rc3',
    date: '2026-11-25',
    en: {
        tagline: 'Your own account — the shared demo stays as it is.',
        items: [
            {
                title: 'Accounts',
                text: 'Secure your user ID with a password and a recovery email.'
            },
            {
                title: 'Create an account',
                text: 'New here? Create your own account right in the app.'
            },
            {
                title: 'Demo unchanged',
                text: 'The shared demo user123 still works without an account.'
            }
        ]
    },
    de: {
        tagline: 'Dein eigenes Konto — die gemeinsame Demo bleibt, wie sie ist.',
        items: [
            {
                title: 'Konten',
                text: 'Sichere deine Benutzer-ID mit einem Passwort und einer Wiederherstellungs-E-Mail.'
            },
            {
                title: 'Konto erstellen',
                text: 'Neu hier? Erstelle dein eigenes Konto direkt in der App.'
            },
            {
                title: 'Demo unverändert',
                text: 'Der Demo-Benutzer user123 funktioniert weiterhin ohne Konto.'
            }
        ]
    },
    es: {
        tagline: 'Tu propia cuenta: la demo compartida sigue igual.',
        items: [
            {
                title: 'Cuentas',
                text: 'Protege tu ID de usuario con una contraseña y un correo de recuperación.'
            },
            {
                title: 'Crear una cuenta',
                text: '¿Eres nuevo? Crea tu propia cuenta desde la app.'
            },
            {
                title: 'Demo sin cambios',
                text: 'El usuario de demo user123 sigue funcionando sin cuenta.'
            }
        ]
    },
    fr: {
        tagline: 'Votre propre compte — la démo partagée reste inchangée.',
        items: [
            {
                title: 'Comptes',
                text: 'Sécurisez votre ID utilisateur avec un mot de passe et un e-mail de récupération.'
            },
            {
                title: 'Créer un compte',
                text: 'Nouveau ? Créez votre propre compte directement dans l’app.'
            },
            {
                title: 'Démo inchangée',
                text: 'L’utilisateur de démo user123 fonctionne toujours sans compte.'
            }
        ]
    }
};
