/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

// Precache the built app shell (injected by vite-plugin-pwa at build time).
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

// Show a notification when the server pushes one.
self.addEventListener("push", (event) => {
  let data: PushPayload = {};
  try {
    if (event.data) data = event.data.json();
  } catch {
    data = { title: "Family Todo", body: event.data?.text() ?? "" };
  }
  const title = data.title ?? "Family Todo";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body ?? "",
      // Icon/badge can be themed per-recipient by the server (see convex/push.ts).
      icon: data.icon ?? "/icons/icon-192.png",
      badge: data.badge ?? "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url ?? "/" },
      // @ts-expect-error vibrate is valid on Android but missing in TS lib types
      vibrate: [80, 40, 80],
    }),
  );
});

// Focus (or open) the app when a notification is tapped.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url as string) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients as readonly WindowClient[]) {
          client.navigate(targetUrl);
          return client.focus();
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
