import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { listPresets, insertPreset, getPreset } from '$lib/server/presets/repo';
import { validatePresetInput } from '$lib/server/presets/validator';
import { slugify, uniqueSlug } from '$lib/server/presets/slug';

export const prerender = false;

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  const presets = listPresets(getDb());
  return json({ version: 1, presets }, { headers: { 'Cache-Control': 'private, max-age=60' } });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  if (locals.user.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const body = await request.json().catch(() => null);
  const result = validatePresetInput(body);
  if (!result.ok) return json({ error: result.error }, { status: 400 });

  const db = getDb();
  const id = result.value.id ?? uniqueSlug(db, slugify(result.value.label));
  insertPreset(
    db,
    {
      id,
      label: result.value.label,
      icon: result.value.icon,
      kind: result.value.kind,
      value: result.value.value
    },
    locals.user.id
  );
  const created = getPreset(db, id);
  return json(created, { status: 201 });
};
