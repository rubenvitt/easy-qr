import { json, type RequestHandler } from '@sveltejs/kit';
import { requireDb } from '$lib/server/db';
import { listPresets } from '$lib/server/presets/repo';

export const prerender = false;

export const GET: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  const presets = await listPresets(requireDb(platform));
  return json({ version: 1, presets }, { headers: { 'Cache-Control': 'private, max-age=60' } });
};
