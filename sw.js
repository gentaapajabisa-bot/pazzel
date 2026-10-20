const V = "pazzel-v2";
const A = ["./","index.html","css/styles.css","css/extra.css","js/theme.js","js/app.js","js/extra.js","manifest.webmanifest","icon.svg","icon-192.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(V).then(c => c.addAll(A)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request;
  if(r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); return res; })
    .catch(() => caches.match(r).then(m => m || caches.match("index.html"))));
});
