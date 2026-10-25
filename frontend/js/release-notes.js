/* ==========================================================================
   locate.me – App-local release notes
   Compact, app-specific notes for the "What's new" dialog. The static website
   remains the full release archive; this file contains only the latest release
   in all app languages. Unsupported languages fall back to English in the UI.
   Update this file together with the website notes and the APP_VERSION bump
   (and refresh the app.js/style.css cache-busters) for every release.
   ========================================================================== */

export const RELEASE_NOTES = {
    version: '0.4.5_rc1',
    date: '2026-10-25',
    en: {
        tagline: 'Filter the places around you and see their details right away.',
        items: [
            {
                title: 'Filter by category',
                text: 'Tap a category icon above the places list to show only cafés, shops, sights or whatever you are looking for. The selected icon also shows its name, and a refresh starts unfiltered again.'
            },
            {
                title: 'Place details',
                text: 'Tap a place to unfold its phone number, website, opening hours and wheelchair access right inside the list. Tap it again to close.'
            },
            {
                title: 'Better icons',
                text: 'Sights, gyms and hotels now have their own icons, and leisure is a sun instead of an ambiguous tree.'
            },
            {
                title: 'Clearer addresses',
                text: 'A resolved address shows only street, house number, town and country — no shop or restaurant name from the same building.'
            }
        ]
    },
    de: {
        tagline: 'Filtere die Orte in deiner Nähe und sieh dir ihre Details direkt an.',
        items: [
            {
                title: 'Nach Kategorie filtern',
                text: 'Tippe über der Ortsliste auf ein Kategorie-Icon, um nur Cafés, Geschäfte, Sehenswürdigkeiten oder Ähnliches zu sehen. Das gewählte Icon zeigt zusätzlich seinen Namen; ein Refresh startet wieder ungefiltert.'
            },
            {
                title: 'Details zum Ort',
                text: 'Tippe auf einen Ort, um Telefonnummer, Website, Öffnungszeiten und Barrierefreiheit direkt in der Liste aufzuklappen. Nochmal tippen schließt sie wieder.'
            },
            {
                title: 'Bessere Icons',
                text: 'Sehenswürdigkeiten, Fitnessstudios und Hotels haben jetzt eigene Icons, und Freizeit zeigt eine Sonne statt eines missverständlichen Baums.'
            },
            {
                title: 'Klarere Adressen',
                text: 'Eine aufgelöste Adresse zeigt nur Straße, Hausnummer, Ort und Land – keine Laden- oder Restaurantnamen aus demselben Gebäude.'
            }
        ]
    },
    es: {
        tagline: 'Filtra los lugares cercanos y consulta sus detalles al momento.',
        items: [
            {
                title: 'Filtrar por categoría',
                text: 'Toca un icono de categoría encima de la lista para ver solo cafeterías, tiendas, lugares de interés o lo que busques. El icono activo muestra además su nombre, y al actualizar vuelves a verlo todo.'
            },
            {
                title: 'Detalles del lugar',
                text: 'Toca un lugar para desplegar su teléfono, sitio web, horario y accesibilidad dentro de la lista. Toca de nuevo para cerrarlo.'
            },
            {
                title: 'Mejores iconos',
                text: 'Los lugares de interés, los gimnasios y los hoteles tienen ahora sus propios iconos, y el ocio muestra un sol en lugar de un árbol ambiguo.'
            },
            {
                title: 'Direcciones más claras',
                text: 'Una dirección resuelta muestra solo la calle, el número, la localidad y el país, sin nombres de tiendas o restaurantes del mismo edificio.'
            }
        ]
    },
    fr: {
        tagline: 'Filtrez les lieux autour de vous et consultez leurs détails immédiatement.',
        items: [
            {
                title: 'Filtrer par catégorie',
                text: 'Touchez une icône de catégorie au-dessus de la liste pour n’afficher que les cafés, commerces, sites touristiques ou ce que vous cherchez. L’icône active affiche aussi son nom, et une actualisation repart sans filtre.'
            },
            {
                title: 'Détails du lieu',
                text: 'Touchez un lieu pour déplier son téléphone, son site web, ses horaires et son accessibilité directement dans la liste. Touchez à nouveau pour refermer.'
            },
            {
                title: 'De meilleures icônes',
                text: 'Les sites touristiques, les salles de sport et les hôtels ont désormais leurs propres icônes, et les loisirs affichent un soleil plutôt qu’un arbre ambigu.'
            },
            {
                title: 'Adresses plus claires',
                text: 'Une adresse résolue n’affiche que la rue, le numéro, la localité et le pays — plus de nom de commerce ou de restaurant du même bâtiment.'
            }
        ]
    }
};
