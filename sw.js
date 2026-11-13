const CACHE_NAME = "junior-savy-v2";

// Chemins absolus depuis la racine du site.
// Les noms d'icônes doivent correspondre EXACTEMENT à ceux du manifest.json.
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

/* ============================================================
   INSTALLATION
   ============================================================ */
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // cache.addAll() est tout-ou-rien : une seule 404 et tout échoue.
    // On cache chaque fichier individuellement pour rester robuste.
    await Promise.all(FILES_TO_CACHE.map(async (file) => {
      try {
        const res = await fetch(file, { cache: "reload" });
        if (res && res.ok) await cache.put(file, res);
      } catch (_) {
        // fichier absent : on continue, l'app fonctionnera quand même
      }
    }));

    await self.skipWaiting();
  })());
});

/* ============================================================
   ACTIVATION + NETTOYAGE
   ============================================================ */
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

/* ============================================================
   FETCH
   ============================================================ */
self.addEventListener("fetch", event => {
  const request = event.request;

  // On ne gère que les GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // On ignore tout ce qui n'est pas de même origine
  if (url.origin !== self.location.origin) return;

  const isHTML =
    request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/");

  /* ---- HTML : network-first ---- */
  if (isHTML) {
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
        // Hors ligne : on sert le cache, avec plusieurs clés possibles
        const cached =
          (await caches.match(request, { ignoreSearch: true })) ||
          (await caches.match("./index.html")) ||
          (await caches.match("./"));

        if (cached) return cached;

        return new Response(
          `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
           <meta name="viewport" content="width=device-width,initial-scale=1">
           <title>JUNIOR SAVY — Hors ligne</title></head>
           <body style="margin:0;padding:40px;background:#0b1220;color:#fff;
                        font-family:Arial,sans-serif;text-align:center">
             <h1 style="color:#22c55e">JUNIOR SAVY</h1>
             <p>Tu es hors ligne.</p>
             <p style="color:#9ca3af">Reconnecte-toi pour charger l'application.</p>
           </body></html>`,
          {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" }
          }
        );
      }
    })());

    return;
  }

  /* ---- Autres fichiers : cache-first ---- */
  event.respondWith((async () => {
    const cached = await caches.match(request);
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
