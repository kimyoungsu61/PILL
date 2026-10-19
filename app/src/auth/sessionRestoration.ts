import { UnauthorizedError } from '../api/client';
import { BROWSER_SESSION_TOKEN } from './browserSession';

type RestoredSession = { token: string; email: string | null } | null;
type Options = {
  web: boolean;
  legacyToken: string | null;
  remembered: boolean;
  signedOut: boolean;
  identify: (token: string) => Promise<{ email: string }>;
};

export async function restoreSession(options: Options): Promise<RestoredSession> {
  if (options.web && options.signedOut) return null;
  const candidate = options.legacyToken || (options.web ? BROWSER_SESSION_TOKEN : null);
  if (!candidate) return null;
  try {
    const identity = await options.identify(candidate);
    return { token: options.web ? BROWSER_SESSION_TOKEN : candidate, email: identity.email };
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) {
      // Network failures must not erase an otherwise remembered login.
      return options.legacyToken || options.remembered ? { token: candidate, email: null } : null;
    }
    if (options.web && options.legacyToken) {
      try {
        const identity = await options.identify(BROWSER_SESSION_TOKEN);
        return { token: BROWSER_SESSION_TOKEN, email: identity.email };
      } catch (cookieError) {
        if (!(cookieError instanceof UnauthorizedError) && options.remembered) {
          return { token: BROWSER_SESSION_TOKEN, email: null };
        }
      }
    }
    return null;
  }
}
