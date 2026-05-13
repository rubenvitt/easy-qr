import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '../../helpers/fake-d1';
import {
  createSession,
  validateSession,
  deleteSession,
  SESSION_TTL_SECONDS
} from '../../../src/lib/server/auth/sessions';

let db: D1Database;
beforeEach(async () => {
  db = createFakeD1().db;
  await db
    .prepare(
      `INSERT INTO users (id, email, display_name, role, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind('u1', 'a@b.de', 'A B', 'admin', 0, 0)
    .run();
});

describe('sessions', () => {
  it('creates and validates', async () => {
    const sid = await createSession(db, 'u1');
    const result = await validateSession(db, sid);
    expect(result?.user.id).toBe('u1');
    expect(result?.user.role).toBe('admin');
  });

  it('returns null for unknown session', async () => {
    expect(await validateSession(db, 'nope')).toBeNull();
  });

  it('returns null and deletes expired sessions', async () => {
    await db
      .prepare(`INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
      .bind('expired', 'u1', Date.now() - 1000, Date.now() - 10000)
      .run();
    expect(await validateSession(db, 'expired')).toBeNull();
    const row = await db.prepare(`SELECT id FROM sessions WHERE id = ?`).bind('expired').first();
    expect(row).toBeNull();
  });

  it('deleteSession removes the row', async () => {
    const sid = await createSession(db, 'u1');
    await deleteSession(db, sid);
    expect(await validateSession(db, sid)).toBeNull();
  });

  it('TTL is 7 days', () => {
    expect(SESSION_TTL_SECONDS).toBe(60 * 60 * 24 * 7);
  });
});
