// Offline: shell appky do cache; síťově první, při výpadku z cache.
const CACHE = 'qk-v0.4';
const SOUBORY = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/ui.js', 'js/projekt.js', 'js/uloziste.js', 'js/body.js', 'js/zapisnik.js', 'js/vypocty.js', 'js/mapa.js', 'js/protokol.js', 'js/stred.js', 'js/soubory.js', 'js/import-totalka.js', 'js/import-ui.js', 'js/export.js', 'js/vypocty2.js', 'geo/krovak.js', 'geo/osa.js',
  'geo/uhly.js', 'geo/zaklad.js', 'geo/stanovisko.js', 'geo/polygon.js', 'geo/presnost.js', 'geo/ostatni.js', 'manifest.webmanifest', 'ikona.svg', 'ikona-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SOUBORY)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((ca) => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
