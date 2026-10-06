// Service worker: makes the game installable ("Aggiungi a schermata Home" on phones) and playable
// offline after the first visit. Pages, scripts and data: network first (updates arrive at once),
// cached copy when offline. Images, sounds and fonts: cache first.
const CACHE = 'spikecode-game-v1';
const STATIC = /\.(png|jpe?g|gif|webp|svg|mp3|ogg|wav|woff2?|ttf|ico)$/i;

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'index.html', 'game.js', 'vendor/phaser.min.js', 'manifest.json']).catch(() => { })));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
    if (STATIC.test(url.pathname)) {
        event.respondWith(caches.open(CACHE).then(async (c) => {
            const hit = await c.match(req);
            if (hit) return hit;
            const res = await fetch(req);
            if (res.ok) c.put(req, res.clone());
            return res;
        }));
        return;
    }
    event.respondWith(fetch(req).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('index.html'))));
});
