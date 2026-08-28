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
    '/app.js?v=0.4.0_20',
    '/css/style.css?v=0.4.0_19',
    '/js/config.js?v=0.3.1_34', '/js/utils.js', '/js/api.js', '/js/state.js',
    '/js/ui/toast.js', '/js/ui/badge.js', '/js/ui/status.js', '/js/ui/map.js',
    '/js/pages/settings.js', '/js/pages/locate.js', '/js/pages/history.js'
];

// Third-party assets cached for offline map support. NetworkFirst keeps them
// fresh when online (network wins); the cache is only the offline fallback.
// Map tiles are intentionally NOT cached. cdnjs sends Access-Control-Allow-Origin:
// *, so these are CORS-readable and cacheable; the SRI integrity check on the
// <script>/<link> tags stays satisfied because the identical file is served.
const THIRD_PARTY = [
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
];

// Install: pre-populate the caches so the offline fallback exists after the
// first online visit, independent of when the SW starts controlling the page.
self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const shellCache = await caches.open('locateme-shell');
        const assetsCache = await caches.open('locateme-assets');
        const thirdPartyCache = await caches.open('locateme-thirdparty');
        await Promise.allSettled(SHELL.map(url => shellCache.add(url)));
        await Promise.allSettled(ASSETS.map(url => assetsCache.add(url)));
        await Promise.allSettled(THIRD_PARTY.map(url => thirdPartyCache.add(url)));
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

    // GET /api/positions (history) – network-first, offline fallback.
    // Deterministic custom handler (raw Cache API): the cache key is normalized
    // to pathname + userId (lat/lon ignored), so an offline fetch matches
    // regardless of GPS variation. Cached responses get the X-LocateMe-Cache
    // header so the frontend can flag "cached data". All other API calls
    // (POST/DELETE, /positions/current, /system/info) stay unrouted.
    async function historyHandler({ request }) {
        const cache = await caches.open('locateme-history');
        const url = new URL(request.url);
        const key = `${url.origin}/api/positions?userId=${encodeURIComponent(url.searchParams.get('userId') || '')}`;

        try {
            const response = await fetch(request);
            if (response.ok) {
                try { await cache.put(key, response.clone()); } catch (e) { /* quota etc. */ }
            }
            return response;
        } catch (err) {
            const cached = await cache.match(key);
            if (!cached) throw err;
            const flagged = new Response(cached.body, {
                status: cached.status,
                statusText: cached.statusText,
                headers: cached.headers
            });
            flagged.headers.set('X-LocateMe-Cache', '1');
            return flagged;
        }
    }

    registerRoute(
        ({ request, url }) =>
            request.method === 'GET' &&
            url.origin === self.location.origin &&
            url.pathname === '/api/positions',
        historyHandler
    );

    // Leaflet CDN assets (JS/CSS) – network-first, so the map keeps working on
    // pages that were loaded while offline (L stays defined). Network wins
    // online; the cached copy is only the offline fallback.
    registerRoute(
        ({ request, url }) =>
            request.method === 'GET' &&
            url.hostname === 'cdnjs.cloudflare.com' &&
            url.pathname.startsWith('/ajax/libs/leaflet/'),
        new NetworkFirst({
            cacheName: 'locateme-thirdparty',
            plugins: [
                new CacheableResponsePlugin({ statuses: [0, 200] }),
                new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 }),
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
