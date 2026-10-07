import { apiRequest } from '../api/client';

const SUBSCRIPTION_KEY = 'pill.web-push.subscription';
let workerPromise: Promise<ServiceWorkerRegistration> | undefined;
export type WebPushState = { id: string; enabled: boolean; reminders: { supplementId: number; time: string }[] };
export type WebPushConfig = { enabled: boolean; publicKey: string };
export type WebPushPreparation = { registration: ServiceWorkerRegistration; subscription: PushSubscription | null };

export function webPushSupport(): 'supported' | 'home-screen-required' | 'unsupported' {
  if (typeof window === 'undefined' || !window.isSecureContext) return 'unsupported';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return 'home-screen-required';
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'supported' : 'unsupported';
}
export function registerWebPushWorker() {
  if (typeof window === 'undefined' || !window.isSecureContext || !('serviceWorker' in navigator)) return undefined;
  if (!workerPromise) {
    workerPromise = navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(async () => {
        return await new Promise<ServiceWorkerRegistration>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('알림 준비에 시간이 걸려요. 잠시 후 다시 시도해 주세요.')), 10000);
          navigator.serviceWorker.ready.then(value => { clearTimeout(timeout); resolve(value); }, error => { clearTimeout(timeout); reject(error); });
        });
      }).catch(error => { workerPromise = undefined; throw error; });
  }
  return workerPromise;
}
export async function prepareWebPush(): Promise<WebPushPreparation> {
  const worker = registerWebPushWorker();
  if (!worker) throw new Error('이 기기에서 웹 알림을 지원하지 않아요.');
  const registration = await worker;
  return { registration, subscription: await registration.pushManager.getSubscription() };
}
export function getWebPushConfig(token: string) { return apiRequest<WebPushConfig>('/api/web-push/config', {}, token); }
export async function getWebPushState(token: string): Promise<WebPushState | null> {
  const id = window.localStorage.getItem(SUBSCRIPTION_KEY);
  if (!id) return null;
  try { return await apiRequest<WebPushState>('/api/web-push/subscriptions/' + encodeURIComponent(id), {}, token); }
  catch (error) {
    if (error instanceof Error && error.message.includes('연결된 알림 기기를 찾지 못했어요')) { window.localStorage.removeItem(SUBSCRIPTION_KEY); return null; }
    throw error;
  }
}
function applicationServerKey(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(window.atob(padded), char => char.charCodeAt(0));
}
export async function connectWebPush(token: string, key: string, prepared: WebPushPreparation): Promise<WebPushState> {
  // subscribe() is invoked before the first await, directly inside the user's tap.
  let subscription = await (prepared.subscription || prepared.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(key) }));
  async function save(value: PushSubscription) {
    const data = value.toJSON();
    if (!data.endpoint || !data.keys?.p256dh || !data.keys?.auth) throw new Error('알림 연결 정보를 읽지 못했어요. 다시 시도해 주세요.');
    return apiRequest<WebPushState>('/api/web-push/subscriptions', { method: 'POST', body: JSON.stringify({ endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul' }) }, token);
  }
  let state: WebPushState;
  try { state = await save(subscription); }
  catch (error) {
    if (!(error instanceof Error) || !error.message.includes('알림 연결을 새로 만들어 주세요')) throw error;
    await subscription.unsubscribe();
    subscription = await prepared.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(key) });
    state = await save(subscription);
  }
  prepared.subscription = subscription;
  window.localStorage.setItem(SUBSCRIPTION_KEY, state.id);
  return state;
}
export function saveWebReminderTimes(token: string, state: WebPushState, supplementId: number, times: string[]) {
  return apiRequest<WebPushState>('/api/web-push/subscriptions/' + encodeURIComponent(state.id) + '/reminders/' + supplementId, { method: 'PUT', body: JSON.stringify({ times }) }, token);
}
export function sendWebPushTest(token: string, state: WebPushState) {
  return apiRequest<void>('/api/web-push/subscriptions/' + encodeURIComponent(state.id) + '/test', { method: 'POST' }, token);
}
export async function disconnectWebPush(token?: string, state?: WebPushState | null) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const id = state?.id || window.localStorage.getItem(SUBSCRIPTION_KEY);
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
  window.localStorage.removeItem(SUBSCRIPTION_KEY);
  if (token && id) await apiRequest<void>('/api/web-push/subscriptions/' + encodeURIComponent(id), { method: 'DELETE' }, token);
}
export function webPushError(error: unknown) {
  if (error instanceof Error && error.name === 'NotAllowedError') return '알림이 허용되지 않았어요. 기기 설정에서 PILL 알림을 켜주세요.';
  return error instanceof Error ? error.message : '알림을 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
}
