import type { Db } from '$lib/server/db';
import type { Role } from './role-mapping';

export interface OidcClaims {
  sub: string;
  email: string;
  name?: string | null;
  role: Role;
}

export function upsertUser(db: Db, claims: OidcClaims): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (id, email, display_name, role, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         display_name = excluded.display_name,
         role = excluded.role,
         last_login_at = excluded.last_login_at`
  ).run(claims.sub, claims.email, claims.name ?? null, claims.role, now, now);
}
