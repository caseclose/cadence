/* Cadence service worker — Web Push + notification click.
 * Served from public/ so Vite copies it to dist/ at the site base path.
 */

const APP_SCOPE = self.registration.scope;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let title = 'Cadence · 有挂起任务到点了';
  let body = '打开应用确认进度。内容已端到端加密，推送不含任务明文。';
  let tag = 'cadence-due';

  try {
    if (event.data) {
      const data = event.data.json();
      if (data && typeof data === 'object') {
        if (typeof data.title === 'string' && data.title) title = data.title;
        if (typeof data.body === 'string' && data.body) body = data.body;
        if (typeof data.tag === 'string' && data.tag) tag = data.tag;
      }
    }
  } catch {
    // non-JSON payload — keep defaults
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: true,
      icon: new URL('icons/icon-192.png', APP_SCOPE).href,
      badge: new URL('icons/icon-192.png', APP_SCOPE).href,
      data: { url: APP_SCOPE },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || APP_SCOPE;

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client && typeof client.navigate === 'function') {
            try {
              await client.navigate(targetUrl);
            } catch {
              // ignore navigate failures
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
