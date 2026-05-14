import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../../helpers/test-db';
import { setDbForTesting, __resetDbForTesting } from '../../../src/lib/server/db';
import { POST } from '../../../src/routes/api/presets/reorder/+server';

let db: ReturnType<typeof createTestDb>;

beforeEach(() => {
  db = createTestDb();
  setDbForTesting(db);
});

afterEach(() => {
  __resetDbForTesting();
});

type TestUser = { id: string; email?: string; displayName?: string; role: 'user' | 'admin' } | null;

function seedPreset(id: string, label: string, sortOrder: number): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO presets (id, label, icon, kind, value, sort_order, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, label, null, 'text', JSON.stringify('v'), sortOrder, now, now, 'seed', 'seed');
}

function callPost(opts: { user: TestUser; body: unknown }): Promise<Response> {
  const request = new Request('http://localhost/api/presets/reorder', {
    method: 'POST',
    body: JSON.stringify(opts.body),
    headers: { 'content-type': 'application/json' }
  });
  return Promise.resolve(
    (
      POST as unknown as (event: {
        request: Request;
        locals: { user: TestUser };
      }) => Response | Promise<Response>
    )({ request, locals: { user: opts.user } })
  );
}

describe('POST /api/presets/reorder', () => {
  it('admin reorders', async () => {
    const uuid = crypto.randomUUID();
    const idA = `re-a-${uuid}`;
    const idB = `re-b-${uuid}`;
    const idC = `re-c-${uuid}`;
    seedPreset(idA, 'A', 1000);
    seedPreset(idB, 'B', 1001);
    seedPreset(idC, 'C', 1002);

    const res = await callPost({
      user: { id: 'admin-r', email: 'a@x', displayName: 'A', role: 'admin' },
      body: { ids: [idC, idA, idB] }
    });
    expect(res.status).toBe(204);

    const rows = db
      .prepare(`SELECT id FROM presets WHERE id IN (?, ?, ?) ORDER BY sort_order, label`)
      .all(idA, idB, idC) as Array<{ id: string }>;
    expect(rows.map((r) => r.id)).toEqual([idC, idA, idB]);
  });

  it('rejects malformed body', async () => {
    const res = await callPost({
      user: { id: 'admin-r2', email: 'a@x', displayName: 'A', role: 'admin' },
      body: {}
    });
    expect(res.status).toBe(400);
  });
});
