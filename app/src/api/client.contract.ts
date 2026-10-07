import {
  ApiTimeoutError,
  UnauthorizedError,
  apiFetch,
  apiRequest,
  developmentApiBaseUrl,
  resolveApiBaseUrl,
  setUnauthorizedHandler,
} from './client';
import type { HomeResponse } from './types';
import { DESIGN_PREVIEW_TOKEN } from '../auth/designPreview';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function expectThrows(action: () => unknown, pattern: RegExp, message: string) {
  try {
    action();
  } catch (error) {
    if (error instanceof Error && pattern.test(error.message)) {
      return;
    }
    throw error;
  }
  throw new Error(message);
}

expectEqual(
  resolveApiBaseUrl('https://api.example.com/', false),
  'https://api.example.com',
  'Production HTTPS URL should be normalized',
);
expectThrows(
  () => resolveApiBaseUrl('http://api.example.com', false),
  /HTTPS/,
  'Production HTTP URL should be rejected',
);
expectEqual(
  resolveApiBaseUrl('http://localhost:18081', false),
  'http://localhost:18081',
  'A local production build should support loopback preview',
);
expectThrows(
  () => resolveApiBaseUrl('http://10.0.2.2:8080', false),
  /HTTPS/,
  'Production HTTP must stay restricted outside loopback',
);
expectEqual(
  resolveApiBaseUrl('http://10.0.2.2:8080', true),
  'http://10.0.2.2:8080',
  'Local development HTTP URL should be allowed',
);
expectThrows(
  () => resolveApiBaseUrl('http://api.example.com', true),
  /local/i,
  'Public development HTTP URL should be rejected',
);
expectEqual(
  developmentApiBaseUrl('web'),
  'http://localhost:8080',
  'Web development should use the local browser API origin',
);
expectEqual(
  developmentApiBaseUrl('native'),
  'http://10.0.2.2:8080',
  'Native development should keep the Android emulator API origin',
);

async function verifyUnauthorizedHandling() {
  const originalFetch = globalThis.fetch;
  let previewFetchCalls = 0;
  globalThis.fetch = async () => {
    previewFetchCalls += 1;
    throw new Error('Design preview home should not call the network');
  };
  const previewHome = await apiRequest<HomeResponse>('/api/home', {}, DESIGN_PREVIEW_TOKEN);
  expectEqual(previewFetchCalls, 0, 'Design preview home should avoid network requests');
  expectEqual(previewHome.supplements.length, 0, 'Design preview should start with no supplements');
  expectEqual(previewHome.todayDoses.length, 0, 'Design preview should start with no doses');

  let handlerCalls = 0;
  setUnauthorizedHandler(async () => {
    handlerCalls += 1;
  });
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () => JSON.stringify({ code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }),
  }) as Response;

  try {
    const results = await Promise.allSettled([
      apiRequest('/api/home', {}, 'expired-token'),
      apiRequest('/api/home', {}, 'expired-token'),
    ]);
    expectEqual(handlerCalls, 1, 'Concurrent authenticated 401 responses should clear auth once');
    for (const result of results) {
      if (result.status !== 'rejected' || !(result.reason instanceof UnauthorizedError)) {
        throw new Error('Authenticated 401 should throw UnauthorizedError');
      }
    }

    await apiRequest('/api/home', {}, 'next-expired-token').catch((error: unknown) => {
      if (!(error instanceof UnauthorizedError)) {
        throw error;
      }
    });
    expectEqual(handlerCalls, 2, 'A later expired session should clear auth again');
  } finally {
    setUnauthorizedHandler(null);
    globalThis.fetch = originalFetch;
  }
}

void verifyUnauthorizedHandling();

async function verifyTimeoutHandling() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(new Error('aborted'));
    }, { once: true });
  });

  try {
    await apiFetch('/api/slow', {}, undefined, 5);
    throw new Error('Timed out requests should reject');
  } catch (error) {
    if (!(error instanceof ApiTimeoutError)) {
      throw error;
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void verifyTimeoutHandling();
