'use strict';

// Bump this whenever the cached shell assets change — old caches are purged on activate.
const CACHE_VERSION = 'weather-dashboard-v1';

// App shell: everything needed to launch offline. Relative paths so the
// worker scope stays under the GitHub Pages sub-path.
const SHELL_ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.webmanifest',
  'icons/apple-touch-icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle same-origin GETs. Live weather (Open-Meteo, cross-origin) and
  // any non-GET always go straight to the network — never cached.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Cache-first for the app shell, with a network fallback that also refreshes
  // the cache so updates land on the next launch.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached); // offline & uncached → let the request fail naturally
    })
  );
});
