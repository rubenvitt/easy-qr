import type { Preset, QrKind } from '$lib/types';
import type { Db } from '$lib/server/db';

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

export function listPresets(db: Db): Preset[] {
  const rows = db
    .prepare(
      `SELECT id, label, icon, kind, value, sort_order FROM presets ORDER BY sort_order, label`
    )
    .all() as Row[];
  return rows.map(rowToPreset);
}

export function getPreset(db: Db, id: string): Preset | null {
  const r = db
    .prepare(`SELECT id, label, icon, kind, value, sort_order FROM presets WHERE id = ?`)
    .get(id) as Row | undefined;
  return r ? rowToPreset(r) : null;
}

export function insertPreset(
  db: Db,
  data: { id: string; label: string; icon?: string; kind: QrKind; value: unknown },
  userId: string
): void {
  const now = Date.now();
  const max = db
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM presets`)
    .get() as { m: number } | undefined;
  db.prepare(
    `INSERT INTO presets (id, label, icon, kind, value, sort_order, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
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
  );
}

export function updatePreset(
  db: Db,
  id: string,
  data: { label: string; icon?: string; kind: QrKind; value: unknown },
  userId: string
): boolean {
  const now = Date.now();
  const info = db
    .prepare(
      `UPDATE presets SET label = ?, icon = ?, kind = ?, value = ?, updated_at = ?, updated_by = ? WHERE id = ?`
    )
    .run(data.label, data.icon ?? null, data.kind, JSON.stringify(data.value), now, userId, id);
  return info.changes > 0;
}

export function deletePreset(db: Db, id: string): boolean {
  const info = db.prepare(`DELETE FROM presets WHERE id = ?`).run(id);
  return info.changes > 0;
}

export function reorderPresets(db: Db, ids: string[]): void {
  const stmt = db.prepare(`UPDATE presets SET sort_order = ? WHERE id = ?`);
  const tx = db.transaction((items: string[]) => {
    items.forEach((id, idx) => {
      stmt.run(idx, id);
    });
  });
  tx(ids);
}
