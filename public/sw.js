// Versioned application assets only. Operational API responses are never replayed as live.
const CACHE_NAME = "avweather-shell-v3";
const SHELL_URLS = [
  "/offline.html",
  "/manifest.json",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("avweather-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            JSON.stringify({
              status: "unavailable",
              unavailable: true,
              offline: true,
              error:
                "Offline. Live aviation data is unavailable. Do not use previously displayed data as current.",
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            },
          ),
      ),
    );
    return;
  }
  // Never mix Next.js RSC/prefetch responses with HTML navigation entries.
  if (request.headers.has("RSC") || url.searchParams.has("_rsc")) return;
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (
    ["style", "script", "image", "font"].includes(request.destination) &&
    url.pathname !== "/sw.js"
  ) {
    event.respondWith(cacheAsset(request));
  }
});
async function networkFirstPage(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (
      response.ok &&
      response.headers.get("content-type")?.includes("text/html")
    ) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match("/offline.html")) ||
      new Response("Offline", { status: 503 })
    );
  }
}
async function cacheAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
