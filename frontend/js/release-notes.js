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
    version: '0.5.0_rc1',
    date: '2026-11-12',
    en: {
        tagline: 'Place details in your history — right where you saved them.',
        items: [
            {
                title: 'Details in History',
                text: 'Unfold a saved place to see its opening hours, phone, website and accessibility.'
            },
            {
                title: 'Longer comments',
                text: 'Comments now hold 75 characters and get two lines while saving.'
            },
            {
                title: 'Safer history',
                text: 'Saved comments are shown as plain text, so nothing in them can run.'
            }
        ]
    },
    de: {
        tagline: 'Ortsdetails im Verlauf — genau dort, wo du sie gespeichert hast.',
        items: [
            {
                title: 'Details im Verlauf',
                text: 'Klappe einen gespeicherten Ort auf und sieh Öffnungszeiten, Telefon, Website und Barrierefreiheit.'
            },
            {
                title: 'Längere Kommentare',
                text: 'Kommentare fassen jetzt 75 Zeichen und haben beim Speichern zwei Zeilen.'
            },
            {
                title: 'Sicherer Verlauf',
                text: 'Gespeicherte Kommentare werden nur als Text angezeigt — nichts darin kann ausgeführt werden.'
            }
        ]
    },
    es: {
        tagline: 'Los detalles de tus lugares, dentro del historial.',
        items: [
            {
                title: 'Detalles en el historial',
                text: 'Despliega un lugar guardado para ver su horario, teléfono, web y accesibilidad.'
            },
            {
                title: 'Comentarios más largos',
                text: 'Los comentarios admiten ahora 75 caracteres y ocupan dos líneas al guardar.'
            },
            {
                title: 'Historial más seguro',
                text: 'Los comentarios guardados se muestran como texto plano, así que nada de lo que contienen puede ejecutarse.'
            }
        ]
    },
    fr: {
        tagline: 'Les détails de vos lieux, directement dans l’historique.',
        items: [
            {
                title: 'Détails dans l’historique',
                text: 'Dépliez un lieu enregistré pour voir horaires, téléphone, site web et accessibilité.'
            },
            {
                title: 'Commentaires plus longs',
                text: 'Les commentaires vont désormais jusqu’à 75 caractères et disposent de deux lignes lors de l’enregistrement.'
            },
            {
                title: 'Historique plus sûr',
                text: 'Les commentaires enregistrés s’affichent en texte brut : rien de ce qu’ils contiennent ne peut s’exécuter.'
            }
        ]
    }
};
