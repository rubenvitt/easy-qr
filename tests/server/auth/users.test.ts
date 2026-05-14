import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../helpers/test-db';
import { upsertUser } from '../../../src/lib/server/auth/users';

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: number;
  last_login_at: number;
};

let db: ReturnType<typeof createTestDb>;
beforeEach(() => {
  db = createTestDb();
});

describe('upsertUser', () => {
  it('inserts a new user', () => {
    upsertUser(db, { sub: 'sub-1', email: 'a@b.de', name: 'Anne', role: 'admin' });
    const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get('sub-1') as UserRow | undefined;
    expect(row!.email).toBe('a@b.de');
    expect(row!.role).toBe('admin');
    expect(row!.last_login_at).toBeGreaterThan(0);
  });

  it('updates fields + last_login on second login', async () => {
    upsertUser(db, { sub: 'sub-1', email: 'a@b.de', name: 'A', role: 'user' });
    const first = db
      .prepare(`SELECT last_login_at FROM users WHERE id = ?`)
      .get('sub-1') as Pick<UserRow, 'last_login_at'> | undefined;
    await new Promise((r) => setTimeout(r, 5));
    upsertUser(db, { sub: 'sub-1', email: 'c@d.de', name: 'C', role: 'admin' });
    const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get('sub-1') as UserRow | undefined;
    expect(row!.email).toBe('c@d.de');
    expect(row!.role).toBe('admin');
    expect(row!.last_login_at).toBeGreaterThan(first!.last_login_at);
  });
});
