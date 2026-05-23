const CACHE_NAME = 'combox-pos-v1';

// ... (Instalación y Activación se quedan igual que antes) ...

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            // 1. Mostrar caché primero (Rápido)
            const cachedResponse = await cache.match(event.request);

            // 2. Ir a la red por los datos nuevos en segundo plano
            const networkFetch = fetch(event.request).then(async (networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
                    
                    // Guardar en caché
                    cache.put(event.request, networkResponse.clone());

                    // Si es tu API de Apps Script, leemos el JSON nuevo y avisamos a la app
                    if (event.request.url.includes('script.google')) {
                        const newData = await networkResponse.clone().json();
                        
                        // Buscar todas las pestañas abiertas de tu app y enviarles el JSON
                        const clients = await self.clients.matchAll();
                        clients.forEach(client => {
                            client.postMessage({
                                tipo: 'ACTUALIZACION_JSON',
                                datos: newData
                            });
                        });
                    }
                }
                return networkResponse;
            }).catch(() => {
                // Modo offline (silencioso)
            });

            // Entregar caché si existe, si no, esperar a la red
            return cachedResponse || networkFetch;
        })
    );
});
