/* ==========================================================================
   locate.me – App-local release notes
   Compact, app-specific notes for the "What's new" dialog. The static website
   remains the full release archive; this file contains only the latest release
   in all app languages. Unsupported languages fall back to English in the UI.
   Update this file together with the website notes and the APP_VERSION bump
   (and refresh the app.js/style.css cache-busters) for every release.
   ========================================================================== */

export const RELEASE_NOTES = {
    version: '0.4.4',
    date: '2026-10-18',
    en: {
        tagline: 'A fresher look, more places, and a new language.',
        items: [
            {
                title: 'Navigation, refreshed',
                text: 'A modern floating bar with clearer icons and easier one-handed use.'
            },
            {
                title: 'More places nearby',
                text: 'Tourist attractions and hotels now join cafés, shops and services.'
            },
            {
                title: 'History, streamlined',
                text: 'A slimmer layout with cleaner cards, so more entries are visible at a glance.'
            },
            {
                title: 'Bonjour, français!',
                text: 'Choose Français in Settings or let locate.me follow your browser language.'
            }
        ]
    },
    de: {
        tagline: 'Frischer Look, mehr Orte und eine neue Sprache.',
        items: [
            {
                title: 'Neue Navigation',
                text: 'Eine moderne, schwebende Leiste mit klareren Icons und einfacherer einhändiger Bedienung.'
            },
            {
                title: 'Mehr Orte in der Nähe',
                text: 'Sehenswürdigkeiten und Hotels erscheinen jetzt neben Cafés, Geschäften und Services.'
            },
            {
                title: 'Verlauf, aufgeräumt',
                text: 'Ein schlankeres Layout mit klareren Karten – so sind mehr Einträge gleichzeitig sichtbar.'
            },
            {
                title: 'Bonjour, français!',
                text: 'Wähle Français in den Einstellungen – locate.me erscheint dann auf Französisch.'
            }
        ]
    },
    es: {
        tagline: 'Un look más limpio, más lugares y un nuevo idioma.',
        items: [
            {
                title: 'Nueva navegación',
                text: 'Una barra flotante moderna, con iconos más claros y un manejo más fácil con una sola mano.'
            },
            {
                title: 'Más lugares cerca',
                text: 'Las atracciones turísticas y los hoteles ahora aparecen junto a cafeterías, tiendas y servicios.'
            },
            {
                title: 'Historial más ligero',
                text: 'Un diseño más limpio, con tarjetas más claras, para ver más entradas de un vistazo.'
            },
            {
                title: '¡Bonjour, français!',
                text: 'Elige Français en Ajustes o sigue el idioma de tu navegador.'
            }
        ]
    },
    fr: {
        tagline: 'Une interface plus moderne, plus de lieux et une nouvelle langue.',
        items: [
            {
                title: 'Navigation repensée',
                text: 'Une barre flottante moderne, avec des icônes plus claires et une utilisation plus simple à une main.'
            },
            {
                title: 'Plus de lieux à proximité',
                text: 'Les sites touristiques et les hôtels rejoignent les cafés, commerces et services.'
            },
            {
                title: 'Historique allégé',
                text: 'Une mise en page plus légère, avec des cartes plus claires, pour voir plus d’entrées d’un coup d’œil.'
            },
            {
                title: 'Bonjour !',
                text: 'Choisissez Français dans les Réglages ou suivez la langue de votre navigateur.'
            }
        ]
    }
};
