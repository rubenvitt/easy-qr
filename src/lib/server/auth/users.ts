import type { Role } from './role-mapping';

export interface OidcClaims {
	sub: string;
	email: string;
	name?: string | null;
	role: Role;
}

export async function upsertUser(db: D1Database, claims: OidcClaims): Promise<void> {
	const now = Date.now();
	await db
		.prepare(
			`INSERT INTO users (id, email, display_name, role, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         display_name = excluded.display_name,
         role = excluded.role,
         last_login_at = excluded.last_login_at`
		)
		.bind(claims.sub, claims.email, claims.name ?? null, claims.role, now, now)
		.run();
}
