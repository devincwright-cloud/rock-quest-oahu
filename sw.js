/* Rock Quest Oahu service worker — cache shell for offline collection browsing */
const CACHE = "rock-quest-oahu-v8";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/css/styles.css",
  "/js/app.js",
  "/js/store.js",
  "/js/ui.js",
  "/js/identify.js",
  "/js/fieldtests.js",
  "/js/badges.js",
  "/js/explore.js",
  "/js/geo.js",
  "/js/data/catalog.js",
  "/js/data/spots.js",
  "/js/data/spot-missions.js",
  "/js/data/badges-data.js",
  "/icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) {
    return; // network only for identify
  }
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          if (res.ok && url.origin === self.location.origin) {
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
