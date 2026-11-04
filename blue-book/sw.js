// Keeps Blue Book working offline (including the text reader). Bump VERSION when files change.
// Only the app's own files are cached here; your logbook data lives in the browser's private storage, never in this cache.
const VERSION = 'bluebook-v2';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png',
  'js/extract.js', 'js/career.js', 'js/files.js', 'js/image.js', 'js/store.js', 'js/ocr.js', 'js/export.js', 'js/app.js',
  'vendor/tesseract.min.js', 'vendor/worker.min.js', 'vendor/tesseract-core-simd-lstm.wasm.js', 'vendor/tesseract-core-lstm.wasm.js',
  'vendor/eng.traineddata.gz', 'vendor/jspdf.umd.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('bluebook-') && k !== VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const big = /vendor\//.test(e.request.url);
  // The big reader files: cache first. Everything else: network first so updates show up.
  e.respondWith(big
    ? caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(k => k.put(e.request, c)); return r; }))
    : fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(k => k.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
