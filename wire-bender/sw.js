// Keeps the app working offline. Bump VERSION when files change.
const VERSION = 'wirebender-v1';
const FILES = ['./', 'index.html', 'style.css', 'geom.js', 'render.js', 'app.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('wirebender-') && k !== VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Network first so updates show up; fall back to the saved copy when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
