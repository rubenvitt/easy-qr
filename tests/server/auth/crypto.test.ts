import { describe, it, expect } from 'vitest';
import {
	hmacSign,
	hmacVerify,
	toBase64Url,
	fromBase64Url,
	randomHex,
} from '../../../src/lib/server/crypto';

describe('crypto', () => {
	it('signs and verifies', async () => {
		const sig = await hmacSign('hello', 'secret');
		expect(await hmacVerify('hello', sig, 'secret')).toBe(true);
	});

	it('rejects tampered payload', async () => {
		const sig = await hmacSign('hello', 'secret');
		expect(await hmacVerify('hellp', sig, 'secret')).toBe(false);
	});

	it('rejects wrong secret', async () => {
		const sig = await hmacSign('hello', 'secret');
		expect(await hmacVerify('hello', sig, 'other')).toBe(false);
	});

	it('base64url round-trips', () => {
		const bytes = new Uint8Array([0, 1, 2, 250, 251, 252]);
		expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
	});

	it('randomHex returns hex of right length', () => {
		expect(randomHex(16)).toMatch(/^[0-9a-f]{32}$/);
	});
});
