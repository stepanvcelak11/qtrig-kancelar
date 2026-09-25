// Offline: aplikace i knihovny (Three.js, MediaPipe + model ruky) jdou do cache.
// HTML/JS: síť napřed (aktualizace), velké knihovny: cache napřed.
const CACHE = 'geoar-v2';
const CORE = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'js/app.js', 'js/catalog.js', 'js/geodesy.js',
  'js/hands.js', 'js/kinematics.js', 'js/models.js', 'vendor/three.module.min.js', 'vendor/RoomEnvironment.js',
  'vendor/RoundedBoxGeometry.js', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys()
  .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const heavy = url.pathname.includes('/vendor/');
  const network = () => fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((ca) => ca.put(e.request, c)); } return r; });
  e.respondWith(heavy
    ? caches.match(e.request).then((r) => r || network())
    : network().catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
