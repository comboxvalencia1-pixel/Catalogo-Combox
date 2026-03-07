const CACHE_NAME = 'combox-v14';
const IMG_CACHE = 'combox-images-v1';

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(['./index.html', './style.css', './script.js', './manifest.json']);
        })
    );
    self.skipWaiting();
});

self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Estrategia exclusiva para imágenes: Stale-While-Revalidate
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
        event.respondWith(
            caches.open(IMG_CACHE).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    }).catch(() => cachedResponse);
                    
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // Estrategia para API y HTML: Red primero, respaldo de caché
    event.respondWith(
        fetch(event.request).then(response => {
            if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
            }
            return response;
        }).catch(() => caches.match(event.request))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(key => key !== CACHE_NAME && key !== IMG_CACHE).map(key => caches.delete(key))
        ))
    );
    self.clients.claim();
});
