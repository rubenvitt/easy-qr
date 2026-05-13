import type { Handle } from '@sveltejs/kit';
import { requireDb, requireEnv } from '$lib/server/db';
import { readCookie, SESSION_COOKIE, parseSignedCookieValue } from '$lib/server/auth/cookies';
import { validateSession } from '$lib/server/auth/sessions';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  event.locals.sessionId = null;

  try {
    const raw = readCookie(event.request.headers.get('cookie'), SESSION_COOKIE);
    if (raw) {
      const secret = requireEnv(event.platform, 'SESSION_SECRET');
      const sid = await parseSignedCookieValue(raw, secret);
      if (sid) {
        const db = requireDb(event.platform);
        const result = await validateSession(db, sid);
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
