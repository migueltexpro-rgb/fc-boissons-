/* Réseau d'abord, cache en secours : l'appli reste utilisable sans connexion au bord du terrain. */
const CACHE = 'fc-boissons-v20';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'firebase-config.js', 'vendor/firebase-app-compat.js', 'vendor/firebase-auth-compat.js', 'vendor/firebase-firestore-compat.js', 'ballon.svg', 'ballon-180.png', 'ballon-192.png', 'ballon-512.png', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  /* GitHub Pages laisse le navigateur garder chaque fichier 10 minutes : on revalide toujours
     les fichiers de l'appli, pour qu'une mise à jour arrive dès la prochaine ouverture. */
  const own = new URL(e.request.url).origin === location.origin;
  e.respondWith(
    fetch(e.request, own ? { cache: 'no-cache' } : undefined)
      .then(res => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
