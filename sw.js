const CACHE_NAME = "combox-pro-v5";
const urlsToCache = ["./", "./index.html", "./style.css", "./script.js", "./manifest.json"];

self.addEventListener("install", event => {
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener("activate", event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
});

self.addEventListener("fetch", event => {
    event.respondWith(
        fetch(event.request).then(res => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            return res;
        }).catch(() => caches.match(event.request))
    );
});
