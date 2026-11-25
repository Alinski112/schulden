// Offline support: always try the network first, fall back to the saved copy.
const CACHE = 'schuldenberg-v1';
const FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/logic.js', 'js/storage.js', 'js/ui.js', 'icons/icon-180.png', 'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then(async (response) => {
        if (response.ok) await (await caches.open(CACHE)).put(event.request, response.clone());
        return response;
      })
      .catch(async () => (await caches.match(event.request, { ignoreSearch: true })) ?? Response.error()),
  );
});
