import type { Preset, QrKind } from '$lib/types';

interface Row {
  id: string;
  label: string;
  icon: string | null;
  kind: QrKind;
  value: string;
  sort_order: number;
}

function rowToPreset(r: Row): Preset {
  return {
    id: r.id,
    label: r.label,
    icon: r.icon ?? undefined,
    kind: r.kind,
    value: JSON.parse(r.value)
  } as Preset;
}

export async function listPresets(db: D1Database): Promise<Preset[]> {
  const res = await db
    .prepare(
      `SELECT id, label, icon, kind, value, sort_order FROM presets ORDER BY sort_order, label`
    )
    .all<Row>();
  return res.results.map(rowToPreset);
}

export async function getPreset(db: D1Database, id: string): Promise<Preset | null> {
  const r = await db
    .prepare(`SELECT id, label, icon, kind, value, sort_order FROM presets WHERE id = ?`)
    .bind(id)
    .first<Row>();
  return r ? rowToPreset(r) : null;
}

export async function insertPreset(
  db: D1Database,
  data: { id: string; label: string; icon?: string; kind: QrKind; value: unknown },
  userId: string
): Promise<void> {
  const now = Date.now();
  const max = await db
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM presets`)
    .first<{ m: number }>();
  await db
    .prepare(
      `INSERT INTO presets (id, label, icon, kind, value, sort_order, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      data.id,
      data.label,
      data.icon ?? null,
      data.kind,
      JSON.stringify(data.value),
      (max?.m ?? -1) + 1,
      now,
      now,
      userId,
      userId
    )
    .run();
}

export async function updatePreset(
  db: D1Database,
  id: string,
  data: { label: string; icon?: string; kind: QrKind; value: unknown },
  userId: string
): Promise<boolean> {
  const now = Date.now();
  const res = await db
    .prepare(
      `UPDATE presets SET label = ?, icon = ?, kind = ?, value = ?, updated_at = ?, updated_by = ? WHERE id = ?`
    )
    .bind(data.label, data.icon ?? null, data.kind, JSON.stringify(data.value), now, userId, id)
    .run();
  return Boolean((res as { meta?: { changes?: number } }).meta?.changes);
}

export async function deletePreset(db: D1Database, id: string): Promise<boolean> {
  const res = await db.prepare(`DELETE FROM presets WHERE id = ?`).bind(id).run();
  return Boolean((res as { meta?: { changes?: number } }).meta?.changes);
}

export async function reorderPresets(db: D1Database, ids: string[]): Promise<void> {
  const stmts = ids.map((id, idx) =>
    db.prepare(`UPDATE presets SET sort_order = ? WHERE id = ?`).bind(idx, id)
  );
  const batch = (db as unknown as { batch?: (s: unknown[]) => Promise<unknown> }).batch;
  if (typeof batch === 'function') {
    await batch.call(db, stmts);
  } else {
    for (const s of stmts) await (s as { run: () => Promise<unknown> }).run();
  }
}
