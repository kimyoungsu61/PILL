import { apiFetch, beginAuthTransition, setUnauthorizedHandler, UnauthorizedError } from '../api/client';
import { BROWSER_SESSION_TOKEN } from './browserSession';

async function verify() {
  const originalFetch = globalThis.fetch;
  let finishOld: (response: Response) => void = () => {};
  let oldResets = 0;
  let newResets = 0;
  try {
    setUnauthorizedHandler(() => { oldResets++; });
    globalThis.fetch = () => new Promise<Response>(resolve => { finishOld = resolve; });
    const oldRequest = apiFetch('/api/account/profile', {}, BROWSER_SESSION_TOKEN).catch(error => error);
    // Cookie authentication has the same public marker for every account. An
    // explicit transition, not string comparison, separates the request owners.
    beginAuthTransition();
    finishOld(new Response('{}', { status: 401 }));
    if (!((await oldRequest) instanceof UnauthorizedError) || oldResets !== 0) {
      throw new Error('A pre-transition 401 must fail only its own request');
    }

    const replacedRequest = apiFetch('/api/account/profile', {}, BROWSER_SESSION_TOKEN).catch(error => error);
    setUnauthorizedHandler(() => { newResets++; });
    finishOld(new Response('{}', { status: 401 }));
    await replacedRequest;
    if (newResets !== 0) throw new Error('Replacing the handler must invalidate requests from the earlier account');

    globalThis.fetch = async () => new Response('{}', { status: 401 });
    await apiFetch('/api/account/profile', {}, BROWSER_SESSION_TOKEN).catch(() => undefined);
    if (Number(newResets) !== 1) throw new Error('A current account 401 must still clear its session');
    await apiFetch('/api/account/profile', { skipAuthReset: true }, BROWSER_SESSION_TOKEN).catch(() => undefined);
    if (Number(newResets) !== 1) throw new Error('An explicit identity probe must not clear authentication');
  } finally {
    globalThis.fetch = originalFetch;
    setUnauthorizedHandler(null);
  }
}

void verify().catch(error => { throw error; });
