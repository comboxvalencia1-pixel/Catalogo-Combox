const CACHE_NAME = 'combox-v11';
const IMG_CACHE = 'combox-images-v1';

// Instalación: cachear archivos estáticos esenciales
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll([
                './index.html',
                './style.css',
                './script.js',
                './manifest.json',
                './logo_white.png',
                './icon-192.png',
                './icon-512.png'
            ]);
        })
    );
});

// Estrategia de caché:
// - Imágenes: stale-while-revalidate (muestra la cacheada y actualiza en segundo plano)
// - Otros recursos: network first con fallback a caché
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Imágenes
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
        event.respondWith(
            caches.open(IMG_CACHE).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    const fetchPromise = fetch(event.request)
                        .then(networkResponse => {
                            cache.put(event.request, networkResponse.clone());
                            return networkResponse;
                        })
                        .catch(() => cachedResponse);
                    return cachedResponse || fetchPromise;
                });
            })
        );
    } else {
        // HTML, CSS, JS: intentar red, si falla usar caché
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
    }
});

// Limpiar cachés antiguas al activar
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== IMG_CACHE)
                    .map(key => caches.delete(key))
            );
        })
    );
});
