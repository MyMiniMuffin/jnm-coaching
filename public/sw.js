const ASSET_CACHE = 'jnm-assets-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const applyAppBadge = async (count) => {
  if (typeof self.registration.setAppBadge !== 'function') return;

  const nextCount = Math.max(0, Number(count) || 0);
  if (nextCount > 0) {
    await self.registration.setAppBadge(nextCount);
    return;
  }

  if (typeof self.registration.clearAppBadge === 'function') {
    await self.registration.clearAppBadge();
  }
};

self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      title: 'Ny check-in mottatt',
      body: event.data ? event.data.text() : 'En utøver har sendt inn en ny rapport.'
    };
  }

  const title = data.title || 'Ny check-in mottatt';
  const options = {
    body: data.body || 'En utøver har sendt inn en ny rapport.',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'coach-checkin-alert',
    data: {
      url: data.url || '/',
      clientId: data.clientId || null
    }
  };

  const unreadTotal = Number(data.unreadTotal);
  const badgeCount = Number.isFinite(unreadTotal) && unreadTotal > 0 ? unreadTotal : 1;

  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    applyAppBadge(badgeCount)
  ]));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/assets/')) return;

  event.respondWith((async () => {
    const cache = await caches.open(ASSET_CACHE);
    const cached = await cache.match(event.request);
    if (cached) return cached;

    const response = await fetch(event.request);
    if (response.ok) {
      cache.put(event.request, response.clone());
    }
    return response;
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
