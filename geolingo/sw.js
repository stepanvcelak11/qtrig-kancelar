// Offline cache: aplikace funguje i bez signálu (v terénu).
const CACHE = 'geolingo-v13';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/app.js', 'js/engine.js', 'js/store.js', 'js/generators.js', 'js/field.js', 'js/backdrop.js',
  'js/content/u01-03.js', 'js/content/u04-06.js', 'js/content/u07-10.js', 'js/content/u11-13.js', 'js/content/u14-16.js',
  'js/content/vut-bc1.js', 'js/content/vut-bc2.js', 'js/content/vut-bc3.js', 'js/content/vut-ing1.js', 'js/content/vut-ing2.js', 'js/content/vut-ing3.js',
  'js/content/tips-1.js', 'js/content/tips-2.js', 'js/content/tips-3.js', 'js/content/tips-4.js',
  'fonts/lexend-latin-wght-normal.woff2', 'fonts/lexend-latin-ext-wght-normal.woff2',
  'fonts/nunito-latin-wght-normal.woff2', 'fonts/nunito-latin-ext-wght-normal.woff2',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Nejdřív síť (ať jsou vidět novinky), při výpadku cache.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request)
    .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
