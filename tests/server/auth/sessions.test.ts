import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../helpers/test-db';
import {
  createSession,
  validateSession,
  deleteSession,
  SESSION_TTL_SECONDS
} from '../../../src/lib/server/auth/sessions';

let db: ReturnType<typeof createTestDb>;
beforeEach(() => {
  db = createTestDb();
  db.prepare(
    `INSERT INTO users (id, email, display_name, role, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run('u1', 'a@b.de', 'A B', 'admin', 0, 0);
});

describe('sessions', () => {
  it('creates and validates', () => {
    const sid = createSession(db, 'u1');
    const result = validateSession(db, sid);
    expect(result?.user.id).toBe('u1');
    expect(result?.user.role).toBe('admin');
  });

  it('returns null for unknown session', () => {
    expect(validateSession(db, 'nope')).toBeNull();
  });

  it('returns null and deletes expired sessions', () => {
    db.prepare(`INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`).run(
      'expired',
      'u1',
      Date.now() - 1000,
      Date.now() - 10000
    );
    expect(validateSession(db, 'expired')).toBeNull();
    const row = db.prepare(`SELECT id FROM sessions WHERE id = ?`).get('expired');
    expect(row).toBeUndefined();
  });

  it('deleteSession removes the row', () => {
    const sid = createSession(db, 'u1');
    deleteSession(db, sid);
    expect(validateSession(db, sid)).toBeNull();
  });

  it('TTL is 7 days', () => {
    expect(SESSION_TTL_SECONDS).toBe(60 * 60 * 24 * 7);
  });
});
