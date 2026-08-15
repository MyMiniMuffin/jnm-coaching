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
