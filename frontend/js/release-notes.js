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
    version: '0.5.0_rc4',
    date: '2026-11-25',
    en: {
        tagline: 'Your places stay — now with a real account.',
        items: [
            {
                title: 'Secure your existing account',
                text: 'Set a password and a recovery email once for your existing user ID, so nobody else can use it.'
            },
            {
                title: 'New users',
                text: 'Create your own account right in the app — no need to ask for an ID anymore.'
            },
            {
                title: 'Your locations stay yours',
                text: 'Your user ID stays the same and keeps every saved place; it simply becomes your login name.'
            }
        ]
    },
    de: {
        tagline: 'Deine Orte bleiben — jetzt mit einem echten Konto.',
        items: [
            {
                title: 'Bestehendes Konto absichern',
                text: 'Lege einmalig ein Passwort und eine Wiederherstellungs-E-Mail für deine bestehende Benutzer-ID fest, damit niemand sonst sie nutzen kann.'
            },
            {
                title: 'Neue Nutzer',
                text: 'Erstelle dein eigenes Konto direkt in der App — du musst keine ID mehr anfragen.'
            },
            {
                title: 'Deine Orte bleiben deine',
                text: 'Deine Benutzer-ID bleibt gleich und behält alle gespeicherten Orte; sie wird nur dein Anmeldename.'
            }
        ]
    },
    es: {
        tagline: 'Tus lugares se quedan — ahora con una cuenta de verdad.',
        items: [
            {
                title: 'Protege tu cuenta actual',
                text: 'Define una vez una contraseña y un correo de recuperación para tu ID actual, para que nadie más pueda usarlo.'
            },
            {
                title: 'Nuevos usuarios',
                text: 'Crea tu propia cuenta desde la app; ya no hace falta pedir un ID.'
            },
            {
                title: 'Tus lugares siguen siendo tuyos',
                text: 'Tu ID de usuario sigue igual y conserva todos los lugares guardados; solo pasa a ser tu nombre de inicio de sesión.'
            }
        ]
    },
    fr: {
        tagline: 'Vos lieux restent — désormais avec un vrai compte.',
        items: [
            {
                title: 'Sécurisez votre compte existant',
                text: 'Définissez une fois un mot de passe et un e-mail de récupération pour votre ID actuel, afin que personne d’autre ne puisse l’utiliser.'
            },
            {
                title: 'Nouveaux utilisateurs',
                text: 'Créez votre propre compte directement dans l’app — plus besoin de demander un ID.'
            },
            {
                title: 'Vos lieux restent les vôtres',
                text: 'Votre ID utilisateur reste le même et conserve tous les lieux enregistrés ; il devient simplement votre identifiant de connexion.'
            }
        ]
    }
};
