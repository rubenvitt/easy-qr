import { describe, it, expect, beforeAll } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import { POST } from '../../../src/routes/api/presets/reorder/+server';

type TestEnv = {
  DB: D1Database;
  TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1];
};

const testEnv = env as unknown as TestEnv;

beforeAll(async () => {
  await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
});

type TestUser = { id: string; email?: string; displayName?: string; role: 'user' | 'admin' } | null;

async function seedPreset(id: string, label: string, sortOrder: number) {
  const now = Date.now();
  await testEnv.DB.prepare(
    `INSERT INTO presets (id, label, icon, kind, value, sort_order, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, label, null, 'text', JSON.stringify('v'), sortOrder, now, now, 'seed', 'seed')
    .run();
}

function callPost(opts: { user: TestUser; body: unknown }): Promise<Response> {
  const platform = { env: { DB: testEnv.DB } } as unknown as App.Platform;
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
        platform: App.Platform;
      }) => Response | Promise<Response>
    )({ request, locals: { user: opts.user }, platform })
  );
}

describe('POST /api/presets/reorder', () => {
  it('admin reorders', async () => {
    const uuid = crypto.randomUUID();
    const idA = `re-a-${uuid}`;
    const idB = `re-b-${uuid}`;
    const idC = `re-c-${uuid}`;
    await seedPreset(idA, 'A', 1000);
    await seedPreset(idB, 'B', 1001);
    await seedPreset(idC, 'C', 1002);

    const res = await callPost({
      user: { id: 'admin-r', email: 'a@x', displayName: 'A', role: 'admin' },
      body: { ids: [idC, idA, idB] }
    });
    expect(res.status).toBe(204);

    const rows = await testEnv.DB.prepare(
      `SELECT id FROM presets WHERE id IN (?, ?, ?) ORDER BY sort_order, label`
    )
      .bind(idA, idB, idC)
      .all<{ id: string }>();
    expect(rows.results.map((r) => r.id)).toEqual([idC, idA, idB]);
  });

  it('rejects malformed body', async () => {
    const res = await callPost({
      user: { id: 'admin-r2', email: 'a@x', displayName: 'A', role: 'admin' },
      body: {}
    });
    expect(res.status).toBe(400);
  });
});
