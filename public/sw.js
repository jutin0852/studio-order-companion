self.addEventListener("push", (event) => {
  const fallback = { title: "Studio", body: "An order needs your attention.", url: "/orders", tag: "studio-order" };
  let data = fallback;
  try {
    data = event.data ? { ...fallback, ...event.data.json() } : fallback;
  } catch {
    data = fallback;
  }

  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag,
    renotify: true,
    requireInteraction: data.kind === "overdue",
    data: { url: data.url || "/orders" },
    actions: [
      { action: "open-orders", title: "Open orders" },
      { action: "dismiss", title: "Later" },
    ],
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const url = new URL(event.notification.data?.url || "/orders", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
