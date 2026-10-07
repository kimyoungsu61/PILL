import { DESIGN_PREVIEW_TOKEN } from '../auth/designPreview';
import type { ApiError, HomeResponse } from './types';

type DevelopmentRuntime = 'native' | 'web';

export function developmentApiBaseUrl(runtime: DevelopmentRuntime) {
  return runtime === 'web'
    ? 'http://localhost:8080'
    : 'http://10.0.2.2:8080';
}

const DEVELOPMENT_API_BASE_URL = developmentApiBaseUrl(
  typeof document === 'undefined' ? 'native' : 'web',
);
const isDevelopment = typeof __DEV__ === 'boolean'
  ? __DEV__
  : process.env.NODE_ENV !== 'production';

type UnauthorizedHandler = () => void | Promise<void>;

export const DEFAULT_API_TIMEOUT_MS = 20_000;

let unauthorizedHandler: UnauthorizedHandler | null = null;
let unauthorizedHandlerPromise: Promise<void> | null = null;

export class UnauthorizedError extends Error {
  constructor() {
    super('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    this.name = 'UnauthorizedError';
  }
}

export class ApiTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`서버 응답이 ${Math.ceil(timeoutMs / 1000)}초 이상 지연되어 요청을 종료했어요. 다시 시도해 주세요.`);
    this.name = 'ApiTimeoutError';
  }
}

export function resolveApiBaseUrl(value: string | undefined, development: boolean) {
  const candidate = value?.trim() || (development ? DEVELOPMENT_API_BASE_URL : '');
  if (!candidate) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be configured with an HTTPS URL.');
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not a valid URL.');
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must contain only an origin.');
  }
  if (parsed.protocol === 'https:') {
    return parsed.origin;
  }
  if (parsed.protocol === 'http:' && (development && isLocalDevelopmentHost(parsed.hostname)
    || ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname.toLowerCase()))) {
    return parsed.origin;
  }
  if (!development) {
    throw new Error('Production API requests require HTTPS.');
  }
  throw new Error('Development HTTP is allowed only for local API hosts.');
}

export const API_BASE_URL = resolveApiBaseUrl(
  typeof document !== 'undefined' && typeof window !== 'undefined'
    && process.env.EXPO_PUBLIC_LIVE_API === 'true'
    ? window.location.origin
    : process.env.EXPO_PUBLIC_API_BASE_URL,
  isDevelopment,
);

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
  unauthorizedHandlerPromise = null;
}

export function readableErrorMessage(body: string, fallback: string) {
  const trimmed = body.trim();
  if (!trimmed) {
    return fallback;
  }
  if (/^<!doctype html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    return '서버 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.';
  }

  try {
    const parsed = JSON.parse(trimmed) as Partial<ApiError> & { error?: unknown };
    const message = typeof parsed.message === 'string' ? parsed.message.trim() : '';
    if (message) {
      return message.length <= 240 ? message : fallback;
    }
    const legacyMessage = typeof parsed.error === 'string' ? parsed.error.trim() : '';
    if (legacyMessage) {
      return legacyMessage.length <= 240 ? legacyMessage : fallback;
    }
    return fallback;
  } catch {
    return trimmed.length > 240 ? fallback : trimmed;
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  token?: string,
  timeoutMs = DEFAULT_API_TIMEOUT_MS,
) {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('API path must be relative to the configured origin.');
  }
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type') && !isFormData(options.body)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const timeoutController = new AbortController();
  const callerSignal = options.signal;
  let timedOut = false;
  const forwardCallerAbort = () => timeoutController.abort(callerSignal?.reason);
  if (callerSignal?.aborted) {
    forwardCallerAbort();
  } else {
    callerSignal?.addEventListener('abort', forwardCallerAbort, { once: true });
  }
  const timeoutId = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: timeoutController.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new ApiTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', forwardCallerAbort);
  }

  if (token && response.status === 401) {
    await notifyUnauthorized();
    throw new UnauthorizedError();
  }
  return response;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string, timeoutMs = DEFAULT_API_TIMEOUT_MS): Promise<T> {
  if (token === DESIGN_PREVIEW_TOKEN
    && path === '/api/home'
    && (!options.method || options.method.toUpperCase() === 'GET')) {
    return { supplements: [], todayDoses: [] } as HomeResponse as T;
  }

  const response = await apiFetch(path, options, token, timeoutMs);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(readableErrorMessage(message, `요청에 실패했습니다. (${response.status})`));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

async function notifyUnauthorized() {
  if (!unauthorizedHandler) {
    return;
  }
  if (!unauthorizedHandlerPromise) {
    const handler = unauthorizedHandler;
    const currentPromise = Promise.resolve()
      .then(() => handler())
      .catch(() => undefined)
      .finally(() => {
        if (unauthorizedHandlerPromise === currentPromise) {
          unauthorizedHandlerPromise = null;
        }
      });
    unauthorizedHandlerPromise = currentPromise;
  }
  await unauthorizedHandlerPromise;
}

function isFormData(body: BodyInit) {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

function isLocalDevelopmentHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '[::1]'
    || normalized === '::1'
    || normalized === 'host.docker.internal'
    || normalized.endsWith('.local')) {
    return true;
  }

  const octets = normalized.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}
