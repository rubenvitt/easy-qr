import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { validatePresetInput } from '$lib/server/presets/validator';
import { deletePreset, getPreset, updatePreset } from '$lib/server/presets/repo';

export const prerender = false;

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  if (locals.user.role !== 'admin') return new Response('Forbidden', { status: 403 });
  const body = await request.json().catch(() => null);
  const result = validatePresetInput(body);
  if (!result.ok) return json({ error: result.error }, { status: 400 });
  const db = getDb();
  const ok = updatePreset(
    db,
    params.id!,
    {
      label: result.value.label,
      icon: result.value.icon,
      kind: result.value.kind,
      value: result.value.value
    },
    locals.user.id
  );
  if (!ok) return new Response('Not Found', { status: 404 });
  return json(getPreset(db, params.id!));
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  if (locals.user.role !== 'admin') return new Response('Forbidden', { status: 403 });
  const ok = deletePreset(getDb(), params.id!);
  if (!ok) return new Response('Not Found', { status: 404 });
  return new Response(null, { status: 204 });
};
