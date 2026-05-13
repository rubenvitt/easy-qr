/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env as rawEnv } from 'cloudflare:test';
import { hmacSign } from '../../../src/lib/server/crypto';

type TestEnv = {
  DB: D1Database;
  SESSION_SECRET: string;
};

const env = rawEnv as unknown as TestEnv;

export async function seedUserAndSession(role: 'user' | 'admin'): Promise<string> {
  const userId = `u-${crypto.randomUUID()}`;
  const sid = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO users (id, email, display_name, role, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(userId, `${userId}@x.de`, 'T', role, Date.now(), Date.now())
    .run();
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
  )
    .bind(sid, userId, Date.now() + 1e7, Date.now())
    .run();
  return sid;
}

export async function signCookie(sid: string): Promise<string> {
  return `drk_session=${sid}.${await hmacSign(sid, env.SESSION_SECRET as string)}`;
}
