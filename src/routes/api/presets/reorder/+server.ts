import { type RequestHandler } from '@sveltejs/kit';
import { requireDb } from '$lib/server/db';
import { reorderPresets } from '$lib/server/presets/repo';

export const prerender = false;

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  if (locals.user.role !== 'admin') return new Response('Forbidden', { status: 403 });
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  if (!body || !Array.isArray(body.ids) || body.ids.some((x) => typeof x !== 'string')) {
    return new Response('Bad Request', { status: 400 });
  }
  await reorderPresets(requireDb(platform), body.ids as string[]);
  return new Response(null, { status: 204 });
};
