import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '../../helpers/fake-d1';
import { upsertUser } from '../../../src/lib/server/auth/users';

type UserRow = {
	id: string;
	email: string;
	display_name: string | null;
	role: string;
	created_at: number;
	last_login_at: number;
};

let db: D1Database;
beforeEach(() => (db = createFakeD1().db));

describe('upsertUser', () => {
	it('inserts a new user', async () => {
		await upsertUser(db, { sub: 'sub-1', email: 'a@b.de', name: 'Anne', role: 'admin' });
		const row = await db
			.prepare(`SELECT * FROM users WHERE id = ?`)
			.bind('sub-1')
			.first<UserRow>();
		expect(row!.email).toBe('a@b.de');
		expect(row!.role).toBe('admin');
		expect(row!.last_login_at).toBeGreaterThan(0);
	});

	it('updates fields + last_login on second login', async () => {
		await upsertUser(db, { sub: 'sub-1', email: 'a@b.de', name: 'A', role: 'user' });
		const first = await db
			.prepare(`SELECT last_login_at FROM users WHERE id = ?`)
			.bind('sub-1')
			.first<Pick<UserRow, 'last_login_at'>>();
		await new Promise((r) => setTimeout(r, 5));
		await upsertUser(db, { sub: 'sub-1', email: 'c@d.de', name: 'C', role: 'admin' });
		const row = await db
			.prepare(`SELECT * FROM users WHERE id = ?`)
			.bind('sub-1')
			.first<UserRow>();
		expect(row!.email).toBe('c@d.de');
		expect(row!.role).toBe('admin');
		expect(row!.last_login_at).toBeGreaterThan(first!.last_login_at);
	});
});
