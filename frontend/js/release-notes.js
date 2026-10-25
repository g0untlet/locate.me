/* ==========================================================================
   locate.me – App-local release notes
   Compact, app-specific notes for the "What's new" dialog. The static website
   remains the full release archive; this file contains only the latest release
   in all app languages. Unsupported languages fall back to English in the UI.
   Update this file together with the website notes and the APP_VERSION bump
   (and refresh the app.js/style.css cache-busters) for every release.
   Keep the dialog short: one short tagline and three one-sentence bullets —
   long notes are simply not read.
   ========================================================================== */

export const RELEASE_NOTES = {
    version: '0.4.5_rc2',
    date: '2026-10-25',
    en: {
        tagline: 'Filter nearby places and see their details at a glance.',
        items: [
            {
                title: 'Filter by category',
                text: 'Tap a category icon to narrow the places around you.'
            },
            {
                title: 'Place details',
                text: 'Tap a place to unfold phone, website, hours and access; tap again to close.'
            },
            {
                title: 'Better icons',
                text: 'Sights, gyms and hotels are easier to tell apart.'
            }
        ]
    },
    de: {
        tagline: 'Orte filtern und Details auf einen Blick.',
        items: [
            {
                title: 'Nach Kategorie filtern',
                text: 'Tippe ein Kategorie-Icon an, um die Orte in deiner Nähe einzugrenzen.'
            },
            {
                title: 'Details zum Ort',
                text: 'Tippe einen Ort an für Telefon, Website, Öffnungszeiten und Zugang; nochmal tippen schließt.'
            },
            {
                title: 'Bessere Icons',
                text: 'Sehenswürdigkeiten, Fitnessstudios und Hotels sind besser unterscheidbar.'
            }
        ]
    },
    es: {
        tagline: 'Filtra los lugares cercanos y consulta sus detalles.',
        items: [
            {
                title: 'Filtrar por categoría',
                text: 'Toca un icono de categoría para acotar los lugares cercanos.'
            },
            {
                title: 'Detalles del lugar',
                text: 'Toca un lugar para ver teléfono, web, horario y acceso; toca de nuevo para cerrar.'
            },
            {
                title: 'Mejores iconos',
                text: 'Lugares de interés, gimnasios y hoteles se distinguen mejor.'
            }
        ]
    },
    fr: {
        tagline: 'Filtrez les lieux proches et voyez leurs détails.',
        items: [
            {
                title: 'Filtrer par catégorie',
                text: 'Touchez une icône de catégorie pour affiner les lieux à proximité.'
            },
            {
                title: 'Détails du lieu',
                text: 'Touchez un lieu pour voir téléphone, site, horaires et accès ; touchez à nouveau pour fermer.'
            },
            {
                title: 'De meilleures icônes',
                text: 'Sites touristiques, salles de sport et hôtels se distinguent mieux.'
            }
        ]
    }
};
