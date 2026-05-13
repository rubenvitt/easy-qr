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

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const id = randomHex(32);
  const now = Date.now();
  await db
    .prepare(`INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
    .bind(id, userId, now + SESSION_TTL_SECONDS * 1000, now)
    .run();
  return id;
}

export async function validateSession(
  db: D1Database,
  sessionId: string
): Promise<SessionValidation | null> {
  const row = await db
    .prepare(
      `SELECT s.id AS sid, s.expires_at AS exp, u.id AS uid, u.email, u.display_name AS displayName, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .bind(sessionId)
    .first<{
      sid: string;
      exp: number;
      uid: string;
      email: string;
      displayName: string | null;
      role: 'user' | 'admin';
    }>();
  if (!row) return null;
  if (row.exp < Date.now()) {
    await deleteSession(db, sessionId);
    return null;
  }
  return {
    sessionId: row.sid,
    user: { id: row.uid, email: row.email, displayName: row.displayName, role: row.role }
  };
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
}

export async function deleteAllSessionsForUser(db: D1Database, userId: string): Promise<void> {
  await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();
}
