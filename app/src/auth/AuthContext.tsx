import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as SecureStore from './sessionStorage';
import { Platform } from 'react-native';
import { apiRequest, setUnauthorizedHandler } from '../api/client';
import type { AuthResponse, MeResponse } from '../api/types';
import { clearAllDoseReminders } from '../notifications/doseReminderNotifications';
import { disconnectWebPush } from '../notifications/webPush';
import { DESIGN_PREVIEW_TOKEN, isWebDesignPreview } from './designPreview';

type AuthContextValue = {
  token: string | null;
  email: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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
  try {
    await action();
  } catch {
    // Local auth cleanup is best-effort and must continue across storage/plugin failures.
  }
}

async function clearPersistedSession() {
  await Promise.all([
    ignoreFailure(() => SecureStore.deleteItemAsync(TOKEN_KEY)),
    ignoreFailure(() => SecureStore.deleteItemAsync(EMAIL_KEY)),
    ignoreFailure(() => clearAllDoseReminders()),
  ]);
}

async function revokeSession(token: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);
  try {
    await apiRequest<void>('/api/auth/logout', {
      method: 'POST',
      signal: controller.signal,
    }, token);
  } catch {
    // Local credentials still need to be removed when the server is unreachable.
  } finally {
    clearTimeout(timeoutId);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    DESIGN_PREVIEW_ENABLED ? DESIGN_PREVIEW_TOKEN : null,
  );
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!DESIGN_PREVIEW_ENABLED);

  const clearLocalSession = useCallback(async () => {
    if (DESIGN_PREVIEW_ENABLED) {
      setToken(DESIGN_PREVIEW_TOKEN);
      setEmail(null);
      return;
    }
    setToken(null);
    setEmail(null);
    await clearPersistedSession();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearLocalSession);
    return () => setUnauthorizedHandler(null);
  }, [clearLocalSession]);

  useEffect(() => {
    if (DESIGN_PREVIEW_ENABLED) {
      return undefined;
    }

    let isMounted = true;
    async function loadStoredAuth() {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!storedToken) {
          await clearPersistedSession();
          return;
        }

        const restored = await apiRequest<MeResponse>('/api/auth/me', {}, storedToken);
        if (isMounted) {
          setToken(storedToken);
          setEmail(restored.email);
        }
      } catch {
        await clearPersistedSession();
        if (isMounted) {
          setToken(null);
          setEmail(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStoredAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const storeAuth = useCallback(async (response: AuthResponse) => {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, response.token, AUTH_STORAGE_OPTIONS),
      SecureStore.setItemAsync(EMAIL_KEY, response.email, AUTH_STORAGE_OPTIONS),
    ]);
    setToken(response.token);
    setEmail(response.email);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    token,
    email,
    isLoading,
    login: async (nextEmail: string, password: string) => {
      const response = await apiRequest<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: nextEmail.trim(), password }),
      });
      await storeAuth(response);
    },
    signup: async (nextEmail: string, password: string) => {
      const response = await apiRequest<AuthResponse>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email: nextEmail.trim(), password }),
      });
      await storeAuth(response);
    },
    logout: async () => {
      if (Platform.OS === 'web') await ignoreFailure(() => disconnectWebPush());
      if (token) {
        await revokeSession(token);
      }
      await clearLocalSession();
    },
  }), [clearLocalSession, email, isLoading, storeAuth, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
