const CACHE_NAME = "junior-savy-v1";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json"
];

// Installation
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activation et nettoyage des anciens caches JUNIOR SAVY
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key.startsWith("junior-savy-") &&
              key !== CACHE_NAME
            )
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Gestion des requêtes
self.addEventListener("fetch", event => {
  const request = event.request;

  // Ne pas intercepter les requêtes autres que GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Ne pas intercepter les ressources externes
  if (url.origin !== self.location.origin) return;

  // Pages HTML : priorité au réseau, puis au cache
  if (request.mode === "navigate" ||
      url.pathname.endsWith(".html") ||
      url.pathname.endsWith("/")) {

    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, copy);
            });
          }

          return response;
        })
        .catch(async () => {
          return await caches.match(request) ||
                 await caches.match("./index.html");
        })
    );

    return;
  }

  // Autres fichiers : priorité au cache
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, copy);
          });
        }

        return response;
      });
    })
  );
});
