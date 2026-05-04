const CACHE_NAME = 'tubetools-v2';  // <- incrementa la versión
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/en/index.html',
  '/en/calculator.html',
  '/en/blog.html',
  '/en/guide-thumbnails-ctr.html',
  '/en/article1.html',
  '/en/article2.html',
  '/en/article3.html',
  '/en/article4.html',
  '/en/article5.html',
  '/en/article6.html',
  '/en/article7.html',
  '/en/article8.html',
  '/en/article16.html',  // el de 100K suscriptores es muy buscado
  '/favicon.svg',
  '/manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();  // <- activa el nuevo SW inmediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
    )
  );
});
