import { describe, it, expect } from 'vitest';
import { mapRoleFromGroups, NoRoleError } from '../../../src/lib/server/auth/role-mapping';

describe('mapRoleFromGroups', () => {
	it('admin wins over user', () => {
		expect(mapRoleFromGroups(['drk-qr-user', 'drk-qr-admin'])).toBe('admin');
	});
	it('maps drk-qr-user to user', () => {
		expect(mapRoleFromGroups(['drk-qr-user'])).toBe('user');
	});
	it('throws on empty', () => {
		expect(() => mapRoleFromGroups([])).toThrow(NoRoleError);
	});
	it('throws on unrelated groups', () => {
		expect(() => mapRoleFromGroups(['x'])).toThrow(NoRoleError);
	});
	it('throws on non-array', () => {
		expect(() => mapRoleFromGroups(undefined as unknown as string[])).toThrow(NoRoleError);
	});
});
