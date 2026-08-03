const CACHE = "trakora-shell-v4";
const SHELL = ["/", "/manifest.webmanifest", "/logo.svg?v=4", "/placeholder-poster.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  if (event.request.url.includes("/api/") || event.request.url.includes("/_next/image")) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          // Clone immediately, before returning the original response to the
          // browser. Waiting for caches.open() first lets the browser consume
          // the body and makes response.clone() throw.
          const cacheCopy = response.clone();
          void caches
            .open(CACHE)
            .then((cache) => cache.put(event.request, cacheCopy))
            .catch(() => undefined);
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "SHOW_NOTIFICATION") return;
  self.registration.showNotification(event.data.title || "Trakora", {
    body: event.data.body || "You have a new update.",
    icon: "/logo.svg?v=4",
    badge: "/logo.svg?v=4",
    data: { url: event.data.url || "/" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});
