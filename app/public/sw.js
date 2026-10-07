'use strict';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
// Deliberately do not intercept fetch: personal API responses never enter a shared cache.
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload;try { payload = event.data ? event.data.json() : null; } catch { return; }
    if (!payload || typeof payload.title !== 'string' || typeof payload.body !== 'string') return;
    const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
    if (typeof data.expiresAt !== 'number') return;
    const expired = data.expiresAt < Date.now();
    let target;try { target = new URL(data.url || '/', self.location.origin); } catch { return; }
    if (target.origin !== self.location.origin || target.pathname !== '/') return;
    const supplementId = Number(data.supplementId);
    await self.registration.showNotification(expired ? '복용 기록을 확인해 주세요' : payload.title.slice(0, 80), {
      body: expired ? '예정된 복용 시간이 지났어요. PILL에서 복용 기록을 확인해 주세요.' : payload.body.slice(0, 240), icon: '/icons/pill-192.png', badge: '/icons/pill-192.png',
      tag: typeof payload.tag === 'string' ? payload.tag.slice(0, 100) : 'pill-reminder',
      data: { url: target.href, supplementId: Number.isSafeInteger(supplementId) && supplementId > 0 ? supplementId : null },
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || '/', self.location.origin);
    if (target.origin !== self.location.origin || target.pathname !== '/') return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) if (new URL(client.url).origin === self.location.origin) {
      await client.focus();client.postMessage({ type: 'PILL_OPEN_SUPPLEMENT', supplementId: event.notification.data?.supplementId });return;
    }
    await self.clients.openWindow(target.href);
  })());
});
