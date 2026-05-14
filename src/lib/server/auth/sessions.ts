import type { Db } from '$lib/server/db';
import { randomHex } from '../crypto';

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';
}

export interface SessionValidation {
  sessionId: string;
  user: SessionUser;
}

export function createSession(db: Db, userId: string): string {
  const id = randomHex(32);
  const now = Date.now();
  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
  ).run(id, userId, now + SESSION_TTL_SECONDS * 1000, now);
  return id;
}

export function validateSession(db: Db, sessionId: string): SessionValidation | null {
  const row = db
    .prepare(
      `SELECT s.id AS sid, s.expires_at AS exp, u.id AS uid, u.email, u.display_name AS displayName, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .get(sessionId) as
    | {
        sid: string;
        exp: number;
        uid: string;
        email: string;
        displayName: string | null;
        role: 'user' | 'admin';
      }
    | undefined;
  if (!row) return null;
  if (row.exp < Date.now()) {
    deleteSession(db, sessionId);
    return null;
  }
  return {
    sessionId: row.sid,
    user: { id: row.uid, email: row.email, displayName: row.displayName, role: row.role }
  };
}

export function deleteSession(db: Db, sessionId: string): void {
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
}

export function deleteAllSessionsForUser(db: Db, userId: string): void {
  db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
}
