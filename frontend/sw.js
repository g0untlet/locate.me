// locate.me Service Worker – v0.2.3_2_1
// Versions-Kommentar ändern → Chrome erkennt geänderte sw.js → neuer SW wird installiert

self.addEventListener('install', (event) => {
    console.log('Service Worker installiert.');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Alten Cache löschen falls vorhanden
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(key => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Schifft Anfragen im Moment einfach nur durch
    event.respondWith(fetch(event.request));
});
