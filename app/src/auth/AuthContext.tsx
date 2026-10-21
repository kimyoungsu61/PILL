import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as SecureStore from './sessionStorage';
import { Platform } from 'react-native';
import { apiRequest, beginAuthTransition, setUnauthorizedHandler } from '../api/client';
import type { AuthResponse, MeResponse } from '../api/types';
import { clearAllDoseReminders } from '../notifications/doseReminderNotifications';
import { DESIGN_PREVIEW_TOKEN, isWebDesignPreview } from './designPreview';
import { BROWSER_SESSION_TOKEN, browserWasRemembered, browserWasSignedOut, forgetBrowser, rememberBrowser, signOutBrowser } from './browserSession';
import { restoreSession } from './sessionRestoration';

type AuthContextValue = {
  token: string | null;
  email: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  closeDeletedAccount: () => Promise<void>;
};
const TOKEN_KEY = 'pill.auth.token';
const EMAIL_KEY = 'pill.auth.email';
const AUTH_STORAGE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const DESIGN_PREVIEW_ENABLED = isWebDesignPreview(
  Platform.OS,
  typeof __DEV__ === 'boolean' ? __DEV__ : process.env.NODE_ENV !== 'production',
  process.env.EXPO_PUBLIC_LIVE_API === 'true',
);
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function ignoreFailure(action: () => Promise<unknown>) {
  try { await action(); } catch { /* Auth cleanup must continue across storage/plugin failures. */ }
}
async function clearStoredCredentials() {
  await Promise.all([
    ignoreFailure(() => SecureStore.deleteItemAsync(TOKEN_KEY)),
    ignoreFailure(() => SecureStore.deleteItemAsync(EMAIL_KEY)),
  ]);
}
async function revokeSession(token: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);
  try { await apiRequest<void>('/api/auth/logout', { method: 'POST', signal: controller.signal, skipAuthReset: true }, token); }
  catch { /* A persisted signed-out flag prevents cookie restoration if this request is offline. */ }
  finally { clearTimeout(timeoutId); }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(DESIGN_PREVIEW_ENABLED ? DESIGN_PREVIEW_TOKEN : null);
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!DESIGN_PREVIEW_ENABLED);
  const operation = useRef(0);

  const clearLocalSession = useCallback(async () => {
    beginAuthTransition();
    operation.current += 1;
    if (DESIGN_PREVIEW_ENABLED) {
      setToken(DESIGN_PREVIEW_TOKEN);
      setEmail(null);
      return;
    }
    setToken(null);
    setEmail(null);
    if (Platform.OS === 'web') forgetBrowser();
    await Promise.all([clearStoredCredentials(), ignoreFailure(() => clearAllDoseReminders())]);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearLocalSession);
    return () => setUnauthorizedHandler(null);
  }, [clearLocalSession]);

  useEffect(() => {
    if (DESIGN_PREVIEW_ENABLED) return undefined;
    let mounted = true;
    const initialOperation = operation.current;
    const current = () => mounted && operation.current === initialOperation;
    async function loadStoredAuth() {
      try {
        const legacyToken = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
        const cachedEmail = await SecureStore.getItemAsync(EMAIL_KEY).catch(() => null);
        const signedOut = Platform.OS === 'web' && browserWasSignedOut();
        if (signedOut) await revokeSession(legacyToken || BROWSER_SESSION_TOKEN);
        const restored = await restoreSession({
          web: Platform.OS === 'web',
          legacyToken,
          remembered: Platform.OS === 'web' && browserWasRemembered(),
          signedOut,
          identify: candidate => apiRequest<MeResponse>('/api/auth/me', { skipAuthReset: true }, candidate),
        });
        if (!current()) return;
        if (restored) {
          if (Platform.OS === 'web' && restored.token === BROWSER_SESSION_TOKEN && restored.email !== null) {
            rememberBrowser();
            await clearStoredCredentials();
          }
          if (!current()) return;
          setToken(restored.token);
          setEmail(restored.email ?? cachedEmail);
        } else {
          if (Platform.OS === 'web') forgetBrowser();
          await clearStoredCredentials();
          if (current()) { setToken(null); setEmail(null); }
        }
      } finally {
        if (current()) setIsLoading(false);
      }
    }
    void loadStoredAuth().catch(() => { if (current()) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const storeAuth = useCallback(async (response: AuthResponse, expectedOperation: number) => {
    if (operation.current !== expectedOperation) return;
    if (Platform.OS === 'web') {
      if (response.token !== BROWSER_SESSION_TOKEN) throw new Error('로그인 연결을 새로고침한 뒤 다시 시도해 주세요.');
      rememberBrowser();
      await clearStoredCredentials();
    } else {
      await Promise.all([
        SecureStore.setItemAsync(TOKEN_KEY, response.token, AUTH_STORAGE_OPTIONS),
        SecureStore.setItemAsync(EMAIL_KEY, response.email, AUTH_STORAGE_OPTIONS),
      ]);
    }
    if (operation.current !== expectedOperation) return;
    setToken(response.token);
    setEmail(response.email);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const authenticatedOperation = operation.current;
    return ({
    token, email, isLoading,
    login: async (nextEmail, password) => {
      beginAuthTransition();
      const expectedOperation = ++operation.current;
      const response = await apiRequest<AuthResponse>('/api/auth/login', {
        method: 'POST', body: JSON.stringify({ email: nextEmail.trim(), password }),
      });
      await storeAuth(response, expectedOperation);
    },
    signup: async (nextEmail, password) => {
      beginAuthTransition();
      const expectedOperation = ++operation.current;
      const response = await apiRequest<AuthResponse>('/api/auth/signup', {
        method: 'POST', body: JSON.stringify({ email: nextEmail.trim(), password }),
      });
      await storeAuth(response, expectedOperation);
    },
    logout: async () => {
      beginAuthTransition();
      const logoutOperation = ++operation.current;
      if (Platform.OS === 'web') signOutBrowser();
      if (token) await revokeSession(token);
      if (operation.current === logoutOperation) await clearLocalSession();
    },
    closeDeletedAccount: async () => {
      // The server has already deleted/revoked this account's sessions. Clean
      // only this device; another authenticated API call would be misleading.
      if (operation.current !== authenticatedOperation) return;
      beginAuthTransition();
      const cleanupOperation = ++operation.current;
      if (Platform.OS === 'web') signOutBrowser();
      // Server-side deletion/revocation stops delivery. Removing a shared browser
      // subscription here could disconnect an account signed in in another tab.
      if (operation.current === cleanupOperation) await clearLocalSession();
    },
  });
  }, [clearLocalSession, email, isLoading, storeAuth, token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
