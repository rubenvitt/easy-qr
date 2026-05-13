import { describe, it, expect, beforeAll } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import { GET } from '../../../src/routes/api/presets/+server';

type TestEnv = {
  DB: D1Database;
  TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1];
};

const testEnv = env as unknown as TestEnv;

beforeAll(async () => {
  await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
});

function callGet(opts: { user: { id: string; role: 'user' | 'admin' } | null }): Promise<Response> {
  const platform = { env: { DB: testEnv.DB } } as unknown as App.Platform;
  return Promise.resolve(
    (
      GET as unknown as (event: {
        locals: { user: typeof opts.user };
        platform: App.Platform;
      }) => Response | Promise<Response>
    )({ locals: { user: opts.user }, platform })
  );
}

describe('GET /api/presets', () => {
  it('returns 401 for anonymous', async () => {
    const res = await callGet({ user: null });
    expect(res.status).toBe(401);
  });

  it('returns presets for an authenticated user', async () => {
    await testEnv.DB.prepare(
      `INSERT INTO presets (id,label,kind,value,sort_order,created_at,updated_at,created_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?)`
    )
      .bind('p1-' + crypto.randomUUID(), 'Eins', 'url', '"https://x"', 0, 0, 0, 'system', 'system')
      .run();
    const res = await callGet({ user: { id: 'u1', role: 'user' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number; presets: Array<{ id: string }> };
    expect(body.version).toBe(1);
    expect(body.presets.length).toBeGreaterThan(0);
  });
});
