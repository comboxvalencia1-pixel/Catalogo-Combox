const CACHE_NAME = 'combox-v13';
const IMG_CACHE = 'combox-images-v13';
const API_CACHE = 'combox-api-cache';

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

    // 1. ESTRATEGIA PARA LA API (Stale-While-Revalidate)
    if (url.includes('script.google.com')) {
        event.respondWith(
            caches.open(API_CACHE).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    }).catch(() => {}); // Falla silenciosa si no hay internet
                    
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // 2. ESTRATEGIA PARA IMÁGENES
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

    // 3. ESTRATEGIA PARA HTML/CSS/JS (Network First, fallback a Caché)
    event.respondWith(
        fetch(event.request).then(response => {
            if (response && response.status === 200) {
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
            keys.filter(key => key !== CACHE_NAME && key !== IMG_CACHE && key !== API_CACHE)
                .map(key => caches.delete(key))
        ))
    );
    self.clients.claim();
});
