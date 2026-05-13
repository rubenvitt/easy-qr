import { describe, it, expect, beforeAll } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import { POST } from '../../../src/routes/api/presets/+server';

type TestEnv = {
  DB: D1Database;
  TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1];
};

const testEnv = env as unknown as TestEnv;

beforeAll(async () => {
  await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
});

type TestUser = { id: string; email?: string; displayName?: string; role: 'user' | 'admin' } | null;

function callPost(opts: { user: TestUser; body: unknown }): Promise<Response> {
  const platform = { env: { DB: testEnv.DB } } as unknown as App.Platform;
  const request = new Request('http://localhost/api/presets', {
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

describe('POST /api/presets', () => {
  it('returns 401 for anonymous', async () => {
    const res = await callPost({
      user: null,
      body: { label: 'X', kind: 'url', value: 'https://x' }
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    const res = await callPost({
      user: { id: 'u-x', email: 'u@x', displayName: 'U', role: 'user' },
      body: { label: 'X', kind: 'url', value: 'https://x' }
    });
    expect(res.status).toBe(403);
  });

  it('admin creates preset with auto-slug from label', async () => {
    const res = await callPost({
      user: { id: 'admin-1', email: 'a@x', displayName: 'A', role: 'admin' },
      body: { label: 'Beispiel Link', kind: 'url', value: 'https://example.com' }
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string; label: string };
    expect(created.id).toBe('beispiel-link');
    expect(created.label).toBe('Beispiel Link');

    const row = await testEnv.DB.prepare(`SELECT id FROM presets WHERE id = ?`)
      .bind('beispiel-link')
      .first<{ id: string }>();
    expect(row?.id).toBe('beispiel-link');
  });

  it('returns 400 for invalid payload (empty label)', async () => {
    const res = await callPost({
      user: { id: 'admin-2', email: 'a@x', displayName: 'A', role: 'admin' },
      body: { label: '', kind: 'url', value: 'https://x' }
    });
    expect(res.status).toBe(400);
  });
});
