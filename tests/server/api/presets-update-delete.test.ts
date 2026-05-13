import { describe, it, expect, beforeAll } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import { PUT, DELETE } from '../../../src/routes/api/presets/[id]/+server';

type TestEnv = {
  DB: D1Database;
  TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1];
};

const testEnv = env as unknown as TestEnv;

beforeAll(async () => {
  await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
});

type TestUser = { id: string; email?: string; displayName?: string; role: 'user' | 'admin' } | null;

async function seedPreset(id: string) {
  const now = Date.now();
  await testEnv.DB.prepare(
    `INSERT INTO presets (id, label, icon, kind, value, sort_order, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, 'Alt', null, 'text', JSON.stringify('alt-value'), 0, now, now, 'seed', 'seed')
    .run();
}

function callPut(opts: { id: string; user: TestUser; body: unknown }): Promise<Response> {
  const platform = { env: { DB: testEnv.DB } } as unknown as App.Platform;
  const request = new Request(`http://localhost/api/presets/${opts.id}`, {
    method: 'PUT',
    body: JSON.stringify(opts.body),
    headers: { 'content-type': 'application/json' }
  });
  return Promise.resolve(
    (
      PUT as unknown as (event: {
        params: { id: string };
        request: Request;
        locals: { user: TestUser };
        platform: App.Platform;
      }) => Response | Promise<Response>
    )({ params: { id: opts.id }, request, locals: { user: opts.user }, platform })
  );
}

function callDelete(opts: { id: string; user: TestUser }): Promise<Response> {
  const platform = { env: { DB: testEnv.DB } } as unknown as App.Platform;
  return Promise.resolve(
    (
      DELETE as unknown as (event: {
        params: { id: string };
        locals: { user: TestUser };
        platform: App.Platform;
      }) => Response | Promise<Response>
    )({ params: { id: opts.id }, locals: { user: opts.user }, platform })
  );
}

describe('PUT /api/presets/:id', () => {
  it('returns 403 for non-admin user', async () => {
    await seedPreset('p-forbidden');
    const res = await callPut({
      id: 'p-forbidden',
      user: { id: 'u-1', email: 'u@x', displayName: 'U', role: 'user' },
      body: { label: 'Neu', kind: 'text', value: 'x' }
    });
    expect(res.status).toBe(403);
  });

  it('admin updates preset', async () => {
    await seedPreset('p-update');
    const res = await callPut({
      id: 'p-update',
      user: { id: 'admin-1', email: 'a@x', displayName: 'A', role: 'admin' },
      body: { label: 'Neu', kind: 'text', value: 'x' }
    });
    expect(res.status).toBe(200);
    const updated = (await res.json()) as { id: string; label: string };
    expect(updated.label).toBe('Neu');
  });

  it('returns 404 for unknown id', async () => {
    const res = await callPut({
      id: 'does-not-exist',
      user: { id: 'admin-2', email: 'a@x', displayName: 'A', role: 'admin' },
      body: { label: 'Neu', kind: 'text', value: 'x' }
    });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/presets/:id', () => {
  it('admin deletes preset', async () => {
    await seedPreset('p-delete');
    const res = await callDelete({
      id: 'p-delete',
      user: { id: 'admin-3', email: 'a@x', displayName: 'A', role: 'admin' }
    });
    expect(res.status).toBe(204);
    const row = await testEnv.DB.prepare(`SELECT id FROM presets WHERE id = ?`)
      .bind('p-delete')
      .first<{ id: string }>();
    expect(row).toBeNull();
  });
});
