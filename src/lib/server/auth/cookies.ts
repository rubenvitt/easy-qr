import { hmacSign, hmacVerify } from '../crypto';

export const SESSION_COOKIE = 'drk_session';
export const OIDC_STATE_COOKIE = 'drk_oidc_state';
export const OIDC_VERIFIER_COOKIE = 'drk_oidc_verifier';
export const OIDC_RETURN_COOKIE = 'drk_oidc_return';

export async function buildSignedCookieValue(payload: string, secret: string): Promise<string> {
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

export async function parseSignedCookieValue(raw: string, secret: string): Promise<string | null> {
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!(await hmacVerify(payload, sig, secret))) return null;
  return payload;
}

interface CookieAttrs {
  maxAge?: number;
  path?: string;
  sameSite?: 'Lax' | 'Strict' | 'None';
  secure?: boolean;
  httpOnly?: boolean;
}

function attrs(a: CookieAttrs): string {
  const parts: string[] = [`Path=${a.path ?? '/'}`];
  if (a.maxAge !== undefined) parts.push(`Max-Age=${a.maxAge}`);
  parts.push(`SameSite=${a.sameSite ?? 'Lax'}`);
  if (a.httpOnly ?? true) parts.push('HttpOnly');
  if (a.secure ?? true) parts.push('Secure');
  return parts.join('; ');
}

export async function serializeSessionCookie(
  sessionId: string,
  secret: string,
  maxAgeSeconds: number
): Promise<string> {
  const value = await buildSignedCookieValue(sessionId, secret);
  return `${SESSION_COOKIE}=${value}; ${attrs({ maxAge: maxAgeSeconds })}`;
}

export function serializeClearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; ${attrs({ maxAge: 0 })}`;
}

export function serializeTransientCookie(name: string, value: string, maxAgeSeconds = 600): string {
  return `${name}=${value}; ${attrs({ maxAge: maxAgeSeconds })}`;
}

export function serializeClearedTransientCookie(name: string): string {
  return `${name}=; ${attrs({ maxAge: 0 })}`;
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}
