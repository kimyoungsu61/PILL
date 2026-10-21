import { apiRequest } from '../api/client';
import type { GardenPot, GardenStamp, GardenState } from './types';

type Request = (path: string, options: RequestInit, token: string) => Promise<GardenState>;

// Keep pending style writes across stack-screen unmounts. A newly opened garden
// must not read an older selection while the previous screen is still saving.
export function createGardenRequests(request: Request) {
  let pendingStyle: Promise<GardenState> | null = null;
  return {
    async read(token: string) {
      while (pendingStyle) await pendingStyle.catch(() => undefined);
      return request('/api/garden', {}, token);
    },
    save(token: string, choice: { pot: GardenPot; stamp: GardenStamp }) {
      // Never queue an unsent mutation: a browser-session cookie can belong to a
      // different account after logout. The caller can retry after this save.
      if (pendingStyle) return Promise.reject(new Error('꾸미기를 저장하고 있어요. 잠시 후 다시 시도해 주세요.'));
      const write = request('/api/garden/style', { method: 'PUT', body: JSON.stringify(choice) }, token);
      pendingStyle = write;
      void write.finally(() => { if (pendingStyle === write) pendingStyle = null; }).catch(() => undefined);
      return write;
    },
  };
}

const requests = createGardenRequests((path, options, token) => apiRequest<GardenState>(path, options, token));
export const readGarden = requests.read;
export const saveGardenStyle = requests.save;
