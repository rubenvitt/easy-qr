const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array): string {
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): Uint8Array {
	const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
	const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
	const buf = new ArrayBuffer(bin.length);
	const out = new Uint8Array(buf);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

async function importKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify'],
	);
}

export async function hmacSign(payload: string, secret: string): Promise<string> {
	const key = await importKey(secret);
	const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
	return toBase64Url(sig);
}

export async function hmacVerify(
	payload: string,
	signature: string,
	secret: string,
): Promise<boolean> {
	const key = await importKey(secret);
	try {
		const sig = fromBase64Url(signature);
		return await crypto.subtle.verify(
			'HMAC',
			key,
			sig.buffer.slice(sig.byteOffset, sig.byteOffset + sig.byteLength) as ArrayBuffer,
			encoder.encode(payload),
		);
	} catch {
		return false;
	}
}

export function randomHex(byteCount: number): string {
	const buf = new Uint8Array(byteCount);
	crypto.getRandomValues(buf);
	return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}
