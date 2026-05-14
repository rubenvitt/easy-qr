import type { Db } from '../../../src/lib/server/db';
import { hmacSign } from '../../../src/lib/server/crypto';

export function seedUserAndSession(db: Db, role: 'user' | 'admin'): string {
  const userId = `u-${crypto.randomUUID()}`;
  const sid = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, display_name, role, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, `${userId}@x.de`, 'T', role, Date.now(), Date.now());
  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
  ).run(sid, userId, Date.now() + 1e7, Date.now());
  return sid;
}

export async function signCookie(sid: string, secret: string): Promise<string> {
  return `drk_session=${sid}.${await hmacSign(sid, secret)}`;
}
