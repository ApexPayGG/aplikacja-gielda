const CACHE_NAME = "stockai-v4";
const OFFLINE_URL = "/offline.html";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/logo.png",
  "/flags/pl.png",
  "/flags/gb.png",
  "/flags/de.png",
  "/flags/es.png",
  "/flags/jp.png",
  "/flags/in.png",
  "/flags/kr.png",
  "/flags/tw.png",
  "/flags/fr.png",
  OFFLINE_URL,
];

const isApiRequest = (requestUrl) =>
  requestUrl.pathname.startsWith("/api") ||
  requestUrl.pathname.includes("/api/") ||
  requestUrl.hostname.startsWith("api.");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => Promise.resolve()),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
            return Promise.resolve();
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (isApiRequest(requestUrl)) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((cachedResponse) => cachedResponse || new Response(null, { status: 503 }))),
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => networkResponse)
        .catch(() =>
          caches.match(event.request).then((cachedResponse) => cachedResponse || caches.match(OFFLINE_URL) || Response.error()),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match(OFFLINE_URL));
    }),
  );
});
