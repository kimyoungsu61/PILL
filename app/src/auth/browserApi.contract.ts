import { apiFetch, apiRequest, setUnauthorizedHandler, UnauthorizedError } from '../api/client';
import { BROWSER_CLIENT_HEADER, BROWSER_SESSION_TOKEN } from './browserSession';

async function verify() {
  const originalFetch = globalThis.fetch;
  let captured: RequestInit | undefined;
  let resets = 0;
  setUnauthorizedHandler(() => { resets++; });
  globalThis.fetch = async (_url, options) => {
    captured = options;
    return new Response(JSON.stringify({ email: 'user@example.com' }), { status: 200 });
  };
  try {
    await apiRequest('/api/auth/me', {}, BROWSER_SESSION_TOKEN);
    const headers = new Headers(captured?.headers);
    if (headers.has('Authorization') || headers.get(BROWSER_CLIENT_HEADER) !== 'web' || captured?.credentials !== 'include') {
      throw new Error('Cookie auth must use browser credentials and CSRF header without a bearer secret');
    }
    globalThis.fetch = async (_url, options) => {
      captured = options;
      return new Response('{}', { status: 401 });
    };
    const probe = await apiFetch('/api/auth/me', { skipAuthReset: true }, BROWSER_SESSION_TOKEN).catch(error => error);
    if (!(probe instanceof UnauthorizedError) || resets !== 0 || 'skipAuthReset' in captured!) {
      throw new Error('Startup probes must not erase another active session or forward internal fetch options');
    }
    await apiFetch('/api/home', {}, BROWSER_SESSION_TOKEN).catch(() => undefined);
    if (Number(resets) !== 1) throw new Error('A revoked active cookie session must clear app authentication');
  } finally {
    globalThis.fetch = originalFetch;
    setUnauthorizedHandler(null);
  }
}
void verify();
