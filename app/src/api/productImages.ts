import { apiRequest } from './client';

export type ProductImageResult = { status: 'FOUND' | 'NOT_FOUND' | 'UNAVAILABLE'; imageUri: string; sourceUrl: string; checkedAt: string };
type Request = (id: number, token: string) => Promise<ProductImageResult>;

// A morning/evening row shares one lookup. Limit background work independently of dose recording.
export function createProductImageLoader(request: Request) {
  const cache = new Map<string, { expiresAt: number; promise: Promise<ProductImageResult> }>();
  const waiting: Array<() => void> = [];
  let active = 0;
  async function run(id: number, token: string) {
    await new Promise<void>(resolve => {
      if (active < 2) { active++; resolve(); }
      else waiting.push(resolve);
    });
    try { return await request(id, token); }
    finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  }
  return (account: string, id: number, token: string) => {
    const key = `${account}:${id}`;
    const existing = cache.get(key);
    if (existing && existing.expiresAt > Date.now()) return existing.promise;
    const entry = { expiresAt: Date.now() + 5 * 60_000, promise: run(id, token) };
    entry.promise.then(result => {
      entry.expiresAt = Date.now() + (result.status === 'FOUND' ? 24 * 60 * 60_000 : 5 * 60_000);
    }, () => { /* Retry later; an optional image failure must not interrupt the screen. */ });
    cache.set(key, entry);
    return entry.promise;
  };
}

export const loadProductImage = createProductImageLoader((id, token) => apiRequest<ProductImageResult>(
  `/api/supplements/${id}/product-image`, { method: 'POST', skipAuthReset: true }, token, 120_000,
));
