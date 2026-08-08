const SHELL_CACHE = "dossier-shell-v2";
const SHELL = ["/", "/rate", "/refine", "/library", "/settings", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const networkOnly = url.pathname.startsWith("/api/") || url.pathname === "/health" || url.pathname.startsWith("/pair");
  if (request.method !== "GET" || url.origin !== self.location.origin || networkOnly) return;
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && response.headers.get("cache-control") !== "no-store") {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") return (await caches.match("/")) ?? Response.error();
    return new Response("Offline", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }));
});
