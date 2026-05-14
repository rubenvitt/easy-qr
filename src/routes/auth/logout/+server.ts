import { type RequestHandler } from '@sveltejs/kit';
import { getDb, optionalEnv } from '$lib/server/db';
import { deleteSession } from '$lib/server/auth/sessions';
import { serializeClearedSessionCookie } from '$lib/server/auth/cookies';

export const prerender = false;

export const POST: RequestHandler = async ({ locals, request }) => {
  const origin = request.headers.get('origin');
  const appOrigin = optionalEnv('APP_ORIGIN');
  if (origin && appOrigin && origin !== appOrigin) {
    return new Response('Forbidden', { status: 403 });
  }
  if (locals.sessionId) {
    deleteSession(getDb(), locals.sessionId);
  }
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': serializeClearedSessionCookie() }
  });
};
