const CACHE_NAME = 'tubetools-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/calculadora.html',
  '/favicon.svg'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

// Estrategia de carga: primero intenta red, si falla usa caché
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
