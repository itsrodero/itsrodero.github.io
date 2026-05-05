const CACHE_NAME = 'itsrodero-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/en/index.html', // versión en inglés
  '/assets/css/styles.css',
  '/assets/js/main.js',
  '/assets/img/hero.webp',
  // Añade aquí todas tus assets críticas
];

// Instalación: cachear assets críticas
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Activación: limpiar caches antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Cache First para assets, Network First para HTML
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Para archivos HTML: Network First (siempre contenido fresco)
  if (event.request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Para CSS, JS, imágenes: Cache First (máximo rendimiento)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
