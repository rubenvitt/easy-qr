import { type RequestHandler } from '@sveltejs/kit';
import { requireDb } from '$lib/server/db';
import { deleteSession } from '$lib/server/auth/sessions';
import { serializeClearedSessionCookie } from '$lib/server/auth/cookies';

export const prerender = false;

export const POST: RequestHandler = async ({ locals, platform, request }) => {
  const origin = request.headers.get('origin');
  const appOrigin = platform?.env?.APP_ORIGIN;
  if (origin && appOrigin && origin !== appOrigin) {
    return new Response('Forbidden', { status: 403 });
  }
  if (locals.sessionId && platform) {
    await deleteSession(requireDb(platform), locals.sessionId);
  }
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': serializeClearedSessionCookie() }
  });
};
