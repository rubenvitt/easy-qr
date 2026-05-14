import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handleErrorWithSentry, sentryHandle } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';
import { dev } from '$app/environment';
import { getDb, getEnv } from '$lib/server/db';
import { readCookie, SESSION_COOKIE, parseSignedCookieValue } from '$lib/server/auth/cookies';
import { validateSession } from '$lib/server/auth/sessions';

const sentryDsn = process.env.PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: dev ? 'development' : 'production',
    tracesSampleRate: 0.1
  });
}

const sessionHandle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  event.locals.sessionId = null;

  try {
    const raw = readCookie(event.request.headers.get('cookie'), SESSION_COOKIE);
    if (raw) {
      const secret = getEnv('SESSION_SECRET');
      const sid = await parseSignedCookieValue(raw, secret);
      if (sid) {
        const db = getDb();
        const result = validateSession(db, sid);
        if (result) {
          event.locals.user = result.user;
          event.locals.sessionId = result.sessionId;
        }
      }
    }
  } catch (err) {
    console.error('hooks.server: session load failed', err);
  }

  return resolve(event);
};

export const handle: Handle = sequence(sentryHandle(), sessionHandle);

export const handleError = handleErrorWithSentry();
