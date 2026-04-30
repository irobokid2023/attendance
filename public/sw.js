// Minimal service worker — required by Chrome to show the PWA install prompt.
// Uses NetworkFirst for navigations so users always get the latest HTML.

const CACHE = "irobokid-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // NetworkFirst for navigation requests — prevents stale shell.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          return fresh;
        } catch (e) {
          const cached = await caches.match(req);
          return cached || Response.error();
        }
      })()
    );
    return;
  }
});
