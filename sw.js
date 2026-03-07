const VERSION = '8.0.1'; // Cambiar esto basado en db.params.version_web
const CACHE_NAME = `combox-v${VERSION}`;

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(['./', './index.html', './style.css', './script.js'])));
});

self.addEventListener('fetch', e => {
    // Estrategia: Stale-While-Revalidate para imágenes
    if (e.request.url.includes('googleusercontent.com')) {
        e.respondWith(
            caches.open('combox-img').then(cache => {
                return cache.match(e.request).then(res => {
                    const fetchPromise = fetch(e.request).then(networkRes => {
                        cache.put(e.request, networkRes.clone());
                        return networkRes;
                    });
                    return res || fetchPromise;
                });
            })
        );
    } else {
        e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    }
});
