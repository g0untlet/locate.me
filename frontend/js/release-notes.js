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
        tagline: 'A fresher look, more places to discover, and a new language.',
        items: [
            {
                title: 'Navigation, refreshed',
                text: 'The bottom bar is now a modern floating dock with clearer icons, a stronger active state, and easier one-handed switching between Locate, History, and Settings.'
            },
            {
                title: 'More places around you',
                text: 'Tourist attractions and hotels now join cafés, shops, and services in “Places around me” — each with its own icon, so sights and stays are easy to spot.'
            },
            {
                title: 'Bonjour, français!',
                text: 'locate.me now speaks French. Choose Français in Settings, or let the app follow your browser language — the interface and nearby place names switch instantly.'
            }
        ]
    },
    de: {
        tagline: 'Ein frischer Look, mehr Orte zum Entdecken und eine neue Sprache.',
        items: [
            {
                title: 'Navigation, neu gedacht',
                text: 'Die untere Leiste ist jetzt eine moderne, schwebende Navigation mit klareren Icons, einem deutlicheren aktiven Tab und einfacherem Wechseln mit einer Hand zwischen Standort, Verlauf und Einstellungen.'
            },
            {
                title: 'Mehr Orte in deiner Nähe',
                text: 'Sehenswürdigkeiten und Hotels erscheinen jetzt neben Cafés, Geschäften und Services in „Orte in der Nähe“ – jedes mit eigenem Icon, damit Ziele und Unterkünfte sofort ins Auge fallen.'
            },
            {
                title: 'Bonjour, français!',
                text: 'locate.me spricht jetzt auch Französisch. Wähle Français in den Einstellungen oder lass die App deiner Browsersprache folgen – Oberfläche und Ortsnamen in der Nähe wechseln sofort.'
            }
        ]
    },
    es: {
        tagline: 'Un aspecto más limpio, más lugares por descubrir y un nuevo idioma.',
        items: [
            {
                title: 'Navegación renovada',
                text: 'La barra inferior ahora es una moderna barra flotante con iconos más claros, un estado activo más visible y un cambio más cómodo con una sola mano entre Ubicación, Historial y Ajustes.'
            },
            {
                title: 'Más lugares cerca de ti',
                text: 'Las atracciones turísticas y los hoteles ahora aparecen junto a cafeterías, tiendas y servicios en «Lugares cercanos», cada uno con su propio icono para reconocerlos de un vistazo.'
            },
            {
                title: '¡Bonjour, français!',
                text: 'locate.me ahora también habla francés. Elige Français en Ajustes o deja que la app siga el idioma de tu navegador; la interfaz y los nombres de los lugares cercanos cambian al instante.'
            }
        ]
    },
    fr: {
        tagline: 'Une interface plus moderne, plus de lieux à découvrir et une nouvelle langue.',
        items: [
            {
                title: 'Navigation repensée',
                text: 'La barre inférieure est désormais une navigation flottante moderne : icônes plus claires, onglet actif plus visible et passage plus facile d’une seule main entre Localiser, Historique et Réglages.'
            },
            {
                title: 'Plus de lieux à proximité',
                text: 'Les sites touristiques et les hôtels rejoignent désormais les cafés, commerces et services dans « Lieux à proximité » — chacun avec sa propre icône, pour repérer immédiatement les sites et les hébergements.'
            },
            {
                title: 'Bonjour !',
                text: 'locate.me parle désormais français. Choisissez Français dans les Réglages ou laissez l’app suivre la langue de votre navigateur — l’interface et les noms des lieux à proximité changent instantanément.'
            }
        ]
    }
};
