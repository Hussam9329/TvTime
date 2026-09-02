const CACHE = "trakora-shell-v6";
const SHELL = ["/manifest.webmanifest", "/logo.svg?v=4", "/placeholder-poster.svg", "/icon-192.png", "/icon-512.png", "/offline.html"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/image")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
    return;
  }
  const cacheable = ["script", "style", "image", "font"].includes(event.request.destination) || ["/manifest.webmanifest", "/offline.html"].includes(url.pathname);
  if (!cacheable) return;
  event.respondWith(caches.match(event.request).then((cached) => {
    const network = fetch(event.request).then((response) => {
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
      }
      return response;
    });
    return cached || network;
  }));
});
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { body: event.data?.text() || "لديك تحديث جديد." }; }
  event.waitUntil(self.registration.showNotification(data.title || "Trakora", { body: data.body || "لديك تحديث جديد.", icon: "/icon-192.png", badge: "/icon-192.png", tag: data.tag || "trakora-update", renotify: true, data: { url: safeNotificationTarget(data.url) } }));
});
self.addEventListener("message", (event) => {
  if (event.data?.type !== "SHOW_NOTIFICATION") return;
  event.waitUntil(self.registration.showNotification(event.data.title || "Trakora", { body: event.data.body || "لديك تحديث جديد.", icon: "/icon-192.png", badge: "/icon-192.png", data: { url: safeNotificationTarget(event.data.url) } }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = safeNotificationTarget(event.notification.data?.url);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.focus(); if ("navigate" in existing) await existing.navigate(target); return; }
    await self.clients.openWindow(target);
  })());
});
function safeNotificationTarget(value) {
  try { const target = new URL(typeof value === "string" ? value : "/", self.location.origin); return target.origin === self.location.origin ? `${target.pathname}${target.search}${target.hash}` : "/"; }
  catch { return "/"; }
}
