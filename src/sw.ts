/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare let self: any;

self.skipWaiting();
clientsClaim();

// The build tool looks for exactly one match of self.__WB_MANIFEST to inject the manifest
const manifest = self.__WB_MANIFEST;
precacheAndRoute(manifest);
cleanupOutdatedCaches();

// Helper to check if a URL is in the precache manifest
const isPrecached = (url: string) => manifest.some(entry => 
  (typeof entry === 'string' && entry === url) || 
  (typeof entry === 'object' && entry.url === url)
);

if (isPrecached("index.html")) {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL("index.html"), {
      allowlist: [/^\/$/],
      denylist: [/^\/~oauth/],
    }),
  );
} else {
  // Fallback for development where index.html might not be precached
  registerRoute(
    new NavigationRoute(async () => {
      const cache = await caches.open("dev-cache");
      const cachedResponse = await cache.match("index.html");
      if (cachedResponse) return cachedResponse;
      return fetch("index.html");
    }, {
      allowlist: [/^\/$/],
      denylist: [/^\/~oauth/],
    })
  );
}

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; url?: string; icon?: string; badge?: string } = {};

  try {
    payload = event.data.json();
  } catch {
    payload = { body: event.data.text() };
  }

  const title = payload.title ?? "Lembrete de manutenção";
  const body = payload.body ?? "Você tem manutenções para revisar.";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: payload.icon ?? "/pwa-192.png",
      badge: payload.badge ?? "/pwa-192.png",
      data: { url: payload.url ?? "/" },
      tag: "maintenance-alert",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url as string | undefined) ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const windowClient = client as WindowClient;
        if (windowClient.url.includes(self.location.origin)) {
          return windowClient.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});