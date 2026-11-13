const CACHE_NAME = "junior-savy-v2";

// Chemins absolus depuis la racine du site (plus fiable que "./")
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-512.png"
];

/* ---------- INSTALLATION ---------- */
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // addAll() est tout-ou-rien : on cache chaque fichier individuellement
    // pour qu'un fichier manquant n'empêche pas l'installation.
    await Promise.all(FILES_TO_CACHE.map(async (file) => {
      try {
        const res = await fetch(file, { cache: "reload" });
        if (res && res.ok) await cache.put(file, res);
      } catch (_) {
        // fichier absent en dev : on ignore
      }
    }));

    await self.skipWaiting();
  })());
});

/* ---------- ACTIVATION ---------- */
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith("junior-savy-") && k !== CACHE_NAME)
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* ---------- FETCH ---------- */
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isHTML =
    request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/");

  if (isHTML) {
    // Network-first : on récupère la dernière version, sinon fallback cache
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then(c => c.put(request, copy))
          );
        }
        return response;
      } catch (_) {
        const cached =
          (await caches.match(request, { ignoreSearch: true })) ||
          (await caches.match("./index.html")) ||
          (await caches.match("./"));
        if (cached) return cached;
        return new Response(
          "<h1>Hors ligne</h1><p>Reconnecte-toi pour charger JUNIOR SAVY.</p>",
          { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
        );
      }
    })());
    return;
  }

  // Cache-first pour le reste (CSS, JS, icônes, manifest)
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: false });
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const copy = response.clone();
        event.waitUntil(
          caches.open(CACHE_NAME).then(c => c.put(request, copy))
        );
      }
      return response;
    } catch (_) {
      return new Response("", { status: 504 });
    }
  })());
});
