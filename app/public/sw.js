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
    await self.registration.showNotification(expired ? '영양제, 챙겨 드셨나요? 💊' : payload.title.slice(0, 80), {
      body: expired ? '알림 시간이 조금 지났어요. 드셨다면 PILL에서 체크해 주세요.' : payload.body.slice(0, 240), icon: '/icons/pill-192.png', badge: '/icons/pill-192.png',
      tag: typeof payload.tag === 'string' ? payload.tag.slice(0, 100) : 'pill-reminder',
      data: { url: target.href, supplementId: Number.isSafeInteger(supplementId) && supplementId > 0 ? supplementId : null,
        doseDate: data.doseDate, doseTime: data.doseTime },
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
      await client.focus();client.postMessage({ type: 'PILL_OPEN_SUPPLEMENT', supplementId: event.notification.data?.supplementId,
        doseDate: event.notification.data?.doseDate, doseTime: event.notification.data?.doseTime });return;
    }
    await self.clients.openWindow(target.href);
  })());
});
