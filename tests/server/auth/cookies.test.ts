import { describe, it, expect } from 'vitest';
import {
	buildSignedCookieValue,
	parseSignedCookieValue,
	serializeSessionCookie,
	serializeClearedSessionCookie,
	serializeTransientCookie,
	readCookie,
	SESSION_COOKIE,
} from '../../../src/lib/server/auth/cookies';

const SECRET = 'unit-test-secret';

describe('signed cookie values', () => {
	it('round-trips', async () => {
		const v = await buildSignedCookieValue('sid-123', SECRET);
		expect(await parseSignedCookieValue(v, SECRET)).toBe('sid-123');
	});
	it('rejects tampering', async () => {
		const v = await buildSignedCookieValue('sid-123', SECRET);
		const [body, sig] = v.split('.');
		expect(await parseSignedCookieValue(`${body}x.${sig}`, SECRET)).toBeNull();
	});
	it('rejects garbage', async () => {
		expect(await parseSignedCookieValue('not-a-cookie', SECRET)).toBeNull();
	});
});

describe('Set-Cookie serialization', () => {
	it('session cookie sets HttpOnly, Secure, SameSite=Lax, Path, Max-Age', async () => {
		const h = await serializeSessionCookie('sid-abc', SECRET, 3600);
		expect(h).toMatch(/^drk_session=/);
		expect(h).toMatch(/HttpOnly/);
		expect(h).toMatch(/Secure/);
		expect(h).toMatch(/SameSite=Lax/);
		expect(h).toMatch(/Path=\//);
		expect(h).toMatch(/Max-Age=3600/);
	});
	it('clears cookie', () => {
		const h = serializeClearedSessionCookie();
		expect(h).toMatch(/Max-Age=0/);
		expect(h).toContain(SESSION_COOKIE);
	});
	it('transient cookie has Max-Age', () => {
		const h = serializeTransientCookie('drk_oidc_state', 'abc', 600);
		expect(h).toMatch(/Max-Age=600/);
	});
});

describe('readCookie', () => {
	it('reads value', () => {
		expect(readCookie('a=1; drk_session=xyz; b=2', 'drk_session')).toBe('xyz');
	});
	it('returns null when absent', () => {
		expect(readCookie('a=1', 'drk_session')).toBeNull();
	});
});
