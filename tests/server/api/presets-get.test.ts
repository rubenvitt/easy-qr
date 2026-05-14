import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../../helpers/test-db';
import { setDbForTesting, __resetDbForTesting } from '../../../src/lib/server/db';
import { GET } from '../../../src/routes/api/presets/+server';

let db: ReturnType<typeof createTestDb>;

beforeEach(() => {
  db = createTestDb();
  setDbForTesting(db);
});

afterEach(() => {
  __resetDbForTesting();
});

type TestUser = { id: string; email?: string; displayName?: string; role: 'user' | 'admin' } | null;

function callGet(opts: { user: TestUser }): Promise<Response> {
  return Promise.resolve(
    (GET as unknown as (event: { locals: { user: TestUser } }) => Response | Promise<Response>)({
      locals: { user: opts.user }
    })
  );
}

describe('GET /api/presets', () => {
  it('returns 401 for anonymous', async () => {
    const res = await callGet({ user: null });
    expect(res.status).toBe(401);
  });

  it('returns presets for an authenticated user', async () => {
    db.prepare(
      `INSERT INTO presets (id,label,kind,value,sort_order,created_at,updated_at,created_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run('p1-' + crypto.randomUUID(), 'Eins', 'url', '"https://x"', 0, 0, 0, 'system', 'system');
    const res = await callGet({ user: { id: 'u1', role: 'user' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number; presets: Array<{ id: string }> };
    expect(body.version).toBe(1);
    expect(body.presets.length).toBeGreaterThan(0);
  });
});
