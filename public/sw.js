/**
 * Cadence Service Worker — offline caching + push notifications.
 *
 * Caches:
 *  - Static assets (JS, CSS, fonts) on install
 *  - Navigation requests with network-first fallback
 *  - API requests are NOT cached (Convex is real-time)
 *
 * Push notifications:
 *  - Receives push from Firebase Cloud Messaging
 *  - Shows notification with deep link
 *  - Handles notification click to navigate to relevant screen
 */

const CACHE_NAME = "cadence-v2";
const STATIC_CACHE = "cadence-static-v2";

const PRE_CACHE = [
  "./",
  "./logo.svg",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRE_CACHE)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

// ── Push Notifications ────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = { title: "Cadence", body: "You have a notification", url: "./dashboard" };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "./logo.svg",
    badge: "./logo.svg",
    vibrate: [100, 50, 100],
    tag: data.tag || "cadence-notification",
    renotify: true,
    data: { url: data.url || "./dashboard" },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url || "/dashboard";
  // Resolve relative URLs against the service worker scope (the app root)
  const resolvedUrl = new URL(rawUrl, self.registration.scope).href;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an existing open window if one matches the app origin
        for (const client of windowClients) {
          if (
            client.url.startsWith(self.registration.scope) &&
            "focus" in client
          ) {
            // Navigate the existing tab to the target deep link, then focus it
            client.navigate(resolvedUrl);
            return client.focus();
          }
        }
        // No matching window — open a new tab
        return clients.openWindow(resolvedUrl);
      }),
  );
});

// ── Fetch Strategy ────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.pathname.includes("/api/")) return;
  if (url.hostname.includes("convex.cloud")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }

  if (
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      }),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
