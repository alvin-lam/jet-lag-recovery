/* Jet Lag & Recovery service worker: offline-first app shell. */
// Bump the version whenever any cached file changes so clients pick up the update.
const CACHE = 'atc-v23';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.webmanifest',
  './js/config.js',
  './js/core/calendar.js',
  './js/core/model.js',
  './js/data/airports.js',
  './js/data/locations.js',
  './js/data/themes.js',
  './js/lib/intervals.js',
  './js/lib/locale.js',
  './js/lib/storage.js',
  './js/lib/time.js',
  './js/lib/util.js',
  './js/main.js',
  './js/pwa.js',
  './js/state.js',
  './js/ui/appearance.js',
  './js/ui/checkin.js',
  './js/ui/dialog.js',
  './js/ui/form.js',
  './js/ui/format.js',
  './js/ui/ics.js',
  './js/ui/install.js',
  './js/ui/legal.js',
  './js/ui/location-picker.js',
  './js/ui/panes.js',
  './js/ui/plan-view.js',
  './js/ui/tabs.js',
  './js/ui/timeline.js',
  './js/ui/to-top.js',
  './assets/fonts/instrument-serif-latin.woff2',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate for same-origin GET requests.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => cached || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
      return cached || network;
    })
  );
});
