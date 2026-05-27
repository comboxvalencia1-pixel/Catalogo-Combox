const CACHE_NAME = 'combox-pos-v5';

// Instalación inmediata
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE_NAME));
});

// Activación inmediata y limpieza profunda
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName); // Elimina combox-pos-v1, v2, etc.
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(event.request);

            const networkFetch = fetch(event.request).then(async (networkResponse) => {
                // AQUÍ EL CAMBIO CLAVE: Aceptar 'basic' (archivos locales) y 'cors' (API externa)
                if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
                    cache.put(event.request, networkResponse.clone());

                    // Comunicación hacia el index.html
                    if (event.request.url.includes('script.google')) {
                        const newData = await networkResponse.clone().json();
                        const clientsList = await self.clients.matchAll();
                        clientsList.forEach(client => {
                            client.postMessage({
                                tipo: 'ACTUALIZACION_JSON',
                                datos: newData
                            });
                        });
                    }
                }
                return networkResponse;
            }).catch(() => null);

            return cachedResponse || networkFetch;
        })
    );
});
