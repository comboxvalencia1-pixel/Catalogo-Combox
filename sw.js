const CACHE_NAME = 'combox-vmax-v1';
const IMG_CACHE = 'combox-images-v1';
const STATIC = ['./', './index.html', './style.css', './script.js', './manifest.json'];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC)));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(k => {
                if (k !== CACHE_NAME && k !== IMG_CACHE) return caches.delete(k);
            })
        ))
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // LÓGICA DE ACTUALIZACIÓN AUTOMÁTICA PARA IMÁGENES
    if (url.hostname.includes('googleusercontent.com') || url.hostname.includes('drive.google.com')) {
        e.respondWith(
            caches.open(IMG_CACHE).then(async cache => {
                // 1. Buscamos si existe la imagen EXACTA con esa URL en el caché
                const cachedResponse = await cache.match(e.request);

                if (cachedResponse) {
                    // Si existe, la devolvemos para que la web cargue rápido
                    // Pero lanzamos una petición al aire para verificar si hay cambios (Stale-While-Revalidate)
                    fetch(e.request).then(networkResponse => {
                        cache.put(e.request, networkResponse);
                    }).catch(() => {});
                    
                    return cachedResponse;
                }

                // 2. Si la URL NO está en el caché (porque es nueva en el Sheets), la descarga
                return fetch(e.request).then(networkResponse => {
                    cache.put(e.request, networkResponse.clone());
                    return networkResponse;
                });
            })
        );
        return;
    }

    // Para el resto (Precios, HTML), siempre buscar en la red primero
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
