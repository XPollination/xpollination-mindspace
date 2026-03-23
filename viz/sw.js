// Mindspace Service Worker — minimal PWA shell
// Serves from viz root so it's accessible at /sw.js regardless of active version

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
