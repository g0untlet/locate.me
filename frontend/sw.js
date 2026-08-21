/* ==========================================================================
   locate.me – Service Worker
   Workbox 7.3.0 (runtime, loaded from Google CDN). Network-First strategy:
   index.html, JS modules and CSS are always fetched from the network while
   online; the cache is only used as a fallback when offline.
   ========================================================================== */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

/* Precache manifest – MUST stay in sync with index.html (?v= cache busters)
   and the js/ module tree. Only files actually served by the Network-First
   routes below (navigations + same-origin script/style) belong here –
   manifest.json, favicon and icons are not intercepted by the SW and are
   therefore not precached. Precache is only the offline fallback: the
   Network-First routes remain the only serving strategy, so content is
   always fresh while online. */
const SHELL = ['/', '/index.html'];
const ASSETS = [
    '/app.js?v=0.3.1_31',
    '/css/style.css?v=0.3.1_25',
    '/js/config.js', '/js/utils.js', '/js/api.js', '/js/state.js',
    '/js/ui/toast.js', '/js/ui/badge.js', '/js/ui/status.js', '/js/ui/map.js',
    '/js/pages/settings.js', '/js/pages/locate.js', '/js/pages/history.js'
];

// Install: pre-populate the caches so the offline fallback exists after the
// first online visit, independent of when the SW starts controlling the page.
self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const shellCache = await caches.open('locateme-shell');
        const assetsCache = await caches.open('locateme-assets');
        await Promise.allSettled(SHELL.map(url => shellCache.add(url)));
        await Promise.allSettled(ASSETS.map(url => assetsCache.add(url)));
        self.skipWaiting();
    })());
});

if (!self.workbox) {
    console.error('Workbox failed to load from CDN – service worker runs without caching.');
} else {
    workbox.setConfig({ debug: false });

    const { registerRoute } = workbox.routing;
    const { NetworkFirst } = workbox.strategies;
    const { CacheableResponsePlugin } = workbox.cacheableResponse;
    const { ExpirationPlugin } = workbox.expiration;

    workbox.core.skipWaiting();
    workbox.core.clientsClaim();

    // App shell / navigations (index.html) – network-first
    registerRoute(
        ({ request }) => request.mode === 'navigate',
        new NetworkFirst({
            cacheName: 'locateme-shell',
            plugins: [
                new CacheableResponsePlugin({ statuses: [0, 200] }),
                new ExpirationPlugin({ maxEntries: 3, maxAgeSeconds: 7 * 24 * 60 * 60 }),
            ],
        })
    );

    // Same-origin JS/CSS assets – network-first
    registerRoute(
        ({ request }) =>
            (request.destination === 'script' || request.destination === 'style') &&
            new URL(request.url).origin === self.location.origin,
        new NetworkFirst({
            cacheName: 'locateme-assets',
            plugins: [
                new CacheableResponsePlugin({ statuses: [0, 200] }),
                new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }),
            ],
        })
    );
}

// Activate: purge legacy caches (incl. leftovers from the removed hand-rolled SW)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => !key.startsWith('locateme-')).map((key) => caches.delete(key)))
        )
    );
});
