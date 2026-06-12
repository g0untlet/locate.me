self.addEventListener('install', (event) => {
    console.log('Service Worker installiert.');
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    // Schifft Anfragen im Moment einfach nur durch
    event.respondWith(fetch(event.request));
});
