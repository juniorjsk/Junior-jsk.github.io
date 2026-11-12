self.addEventListener('install', e => {
  e.waitUntil(
    caches.open('junior-jsk-v2').then(c => c.addAll(['./', './index.html', './manifest.json']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => {
      if (k !== 'junior-jsk-v2') return caches.delete(k);
    })))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
