import { UnauthorizedError } from '../api/client';
import { BROWSER_SESSION_TOKEN, browserWasRemembered, browserWasSignedOut, forgetBrowser, rememberBrowser, signOutBrowser } from './browserSession';
import { restoreSession } from './sessionRestoration';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
async function verify() {
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } } });
  try {
    rememberBrowser();
    check(browserWasRemembered() && !browserWasSignedOut(), 'Remembered login must survive a new app window');
    check([...values.values()].every(value => value === '1'), 'Persistent storage must contain flags, never auth tokens');
    signOutBrowser();
    check(browserWasSignedOut() && !browserWasRemembered(), 'Explicit logout must block cookie restoration even offline');
    let requests = 0;
    const signedOut = await restoreSession({ web: true, legacyToken: null, remembered: false, signedOut: true,
      identify: async () => { requests++; return { email: 'user@example.com' }; } });
    check(signedOut === null && requests === 0, 'Signed-out browser must not restore a remaining cookie');
    rememberBrowser();
    const restored = await restoreSession({ web: true, legacyToken: null, remembered: true, signedOut: false,
      identify: async token => { check(token === BROWSER_SESSION_TOKEN, 'Reopen must use the cookie'); return { email: 'user@example.com' }; } });
    check(restored?.token === BROWSER_SESSION_TOKEN, 'Closing the app must not lose a cookie login');
    const offline = await restoreSession({ web: true, legacyToken: null, remembered: true, signedOut: false,
      identify: async () => { throw new TypeError('Network unavailable'); } });
    check(offline?.token === BROWSER_SESSION_TOKEN, 'A temporary network failure must preserve remembered login');
    const expired = await restoreSession({ web: true, legacyToken: null, remembered: true, signedOut: false,
      identify: async () => { throw new UnauthorizedError(); } });
    check(expired === null, 'An expired or revoked cookie must require login');
    const attempts: string[] = [];
    const migrated = await restoreSession({ web: true, legacyToken: 'old-tab-token', remembered: false, signedOut: false,
      identify: async token => { attempts.push(token); return { email: 'user@example.com' }; } });
    check(migrated?.token === BROWSER_SESSION_TOKEN && attempts[0] === 'old-tab-token', 'Legacy active login must migrate to cookie auth');
    const fallback = await restoreSession({ web: true, legacyToken: 'expired-tab-token', remembered: true, signedOut: false,
      identify: async token => { if (token !== BROWSER_SESSION_TOKEN) throw new UnauthorizedError(); return { email: 'user@example.com' }; } });
    check(fallback?.token === BROWSER_SESSION_TOKEN, 'An old tab token must not mask a valid cookie');
    const native = await restoreSession({ web: false, legacyToken: 'keychain-token', remembered: false, signedOut: false,
      identify: async () => ({ email: 'user@example.com' }) });
    check(native?.token === 'keychain-token', 'Native keychain sessions must remain supported');
    forgetBrowser();
    check(!browserWasRemembered(), 'Revoked sessions must clear the remembered flag');
  } finally {
    if (savedWindow) Object.defineProperty(globalThis, 'window', savedWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}
void verify();
