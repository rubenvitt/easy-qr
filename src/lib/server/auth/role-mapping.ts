export class NoRoleError extends Error {
	constructor() {
		super('User has no matching DRK QR role');
		this.name = 'NoRoleError';
	}
}

export type Role = 'user' | 'admin';

export function mapRoleFromGroups(groups: unknown): Role {
	if (!Array.isArray(groups)) throw new NoRoleError();
	if (groups.includes('drk-qr-admin')) return 'admin';
	if (groups.includes('drk-qr-user')) return 'user';
	throw new NoRoleError();
}
