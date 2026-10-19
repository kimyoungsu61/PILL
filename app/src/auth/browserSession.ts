export const BROWSER_SESSION_TOKEN = 'pill.browser-session';
export const BROWSER_CLIENT_HEADER = 'X-Pill-Client';
const REMEMBERED_KEY = 'pill.auth.remembered';
const SIGNED_OUT_KEY = 'pill.auth.signedOut';

// These flags contain no credentials. The browser alone stores the HttpOnly session cookie.
function readFlag(key: string) {
  try { return typeof window !== 'undefined' && window.localStorage.getItem(key) === '1'; }
  catch { return false; }
}
function writeFlag(key: string, value: boolean) {
  try {
    if (typeof window === 'undefined') return;
    if (value) window.localStorage.setItem(key, '1');
    else window.localStorage.removeItem(key);
  } catch { /* Cookie authentication still works if storage is unavailable. */ }
}
export const browserWasRemembered = () => readFlag(REMEMBERED_KEY);
export const browserWasSignedOut = () => readFlag(SIGNED_OUT_KEY);
export function rememberBrowser() {
  writeFlag(REMEMBERED_KEY, true);
  writeFlag(SIGNED_OUT_KEY, false);
}
export function forgetBrowser() { writeFlag(REMEMBERED_KEY, false); }
export function signOutBrowser() {
  writeFlag(SIGNED_OUT_KEY, true);
  forgetBrowser();
}
