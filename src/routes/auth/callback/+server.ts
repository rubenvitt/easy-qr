import { type RequestHandler } from '@sveltejs/kit';
import { getDb, getEnv } from '$lib/server/db';
import {
  buildOAuth2Client,
  fetchDiscovery,
  fetchUserInfo,
  decodeIdToken
} from '$lib/server/auth/oidc';
import {
  OIDC_STATE_COOKIE,
  OIDC_VERIFIER_COOKIE,
  OIDC_RETURN_COOKIE,
  readCookie,
  serializeClearedTransientCookie,
  serializeSessionCookie
} from '$lib/server/auth/cookies';
import {
  mapRoleFromGroups,
  roleMappingConfigFromEnv,
  NoRoleError
} from '$lib/server/auth/role-mapping';
import { upsertUser } from '$lib/server/auth/users';
import { createSession, SESSION_TTL_SECONDS } from '$lib/server/auth/sessions';
import { sanitizeReturnUrl } from '$lib/server/auth/return-url';

export const prerender = false;

export const GET: RequestHandler = async ({ url, request }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (url.searchParams.get('error'))
    return errorPage(`OIDC-Fehler: ${url.searchParams.get('error')}`, 400);
  if (!code || !state) return errorPage('Fehlende Parameter', 400);

  const cookieHeader = request.headers.get('cookie');
  const storedState = readCookie(cookieHeader, OIDC_STATE_COOKIE);
  const verifier = readCookie(cookieHeader, OIDC_VERIFIER_COOKIE);
  const returnTo = readCookie(cookieHeader, OIDC_RETURN_COOKIE) ?? '/';
  if (!storedState || !verifier || storedState !== state) {
    return errorPage('State stimmt nicht überein', 400);
  }

  const issuer = getEnv('POCKET_ID_ISSUER');
  const discovery = await fetchDiscovery(issuer);
  const client = buildOAuth2Client({
    POCKET_ID_CLIENT_ID: getEnv('POCKET_ID_CLIENT_ID'),
    POCKET_ID_CLIENT_SECRET: getEnv('POCKET_ID_CLIENT_SECRET'),
    POCKET_ID_REDIRECT_URI: getEnv('POCKET_ID_REDIRECT_URI')
  });

  let tokens;
  try {
    tokens = await client.validateAuthorizationCode(discovery.token_endpoint, code, verifier);
  } catch {
    return errorPage('Token-Tausch fehlgeschlagen', 400);
  }

  let userInfo: Record<string, unknown>;
  try {
    userInfo = await fetchUserInfo(discovery, tokens.accessToken());
  } catch {
    return errorPage('UserInfo-Aufruf fehlgeschlagen', 502);
  }

  const idTokenStr = (tokens.data as { id_token?: string }).id_token;
  const idClaims = idTokenStr ? (decodeIdToken(idTokenStr) as Record<string, unknown>) : {};

  const sub = String(userInfo.sub ?? idClaims.sub ?? '');
  const email = String(userInfo.email ?? idClaims.email ?? '');
  const name = (userInfo.name ?? idClaims.name ?? null) as string | null;
  const groups = (userInfo.groups ?? idClaims.groups ?? []) as unknown;

  if (!sub || !email) return errorPage('Pflicht-Claims fehlen', 400);

  let role;
  try {
    role = mapRoleFromGroups(groups, roleMappingConfigFromEnv());
  } catch (e) {
    if (e instanceof NoRoleError) return errorPage('Kein Zugriff — bitte Admin kontaktieren', 403);
    throw e;
  }

  const db = getDb();
  upsertUser(db, { sub, email, name, role });
  const sessionId = createSession(db, sub);

  const cookie = await serializeSessionCookie(
    sessionId,
    getEnv('SESSION_SECRET'),
    SESSION_TTL_SECONDS
  );

  const headers = new Headers({ Location: sanitizeReturnUrl(returnTo) });
  headers.append('Set-Cookie', cookie);
  headers.append('Set-Cookie', serializeClearedTransientCookie(OIDC_STATE_COOKIE));
  headers.append('Set-Cookie', serializeClearedTransientCookie(OIDC_VERIFIER_COOKIE));
  headers.append('Set-Cookie', serializeClearedTransientCookie(OIDC_RETURN_COOKIE));
  return new Response(null, { status: 302, headers });
};

function errorPage(msg: string, status: number): Response {
  const safe = msg.replace(
    /[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!
  );
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Login fehlgeschlagen</title>` +
      `<main style="font:16px system-ui;padding:2rem;max-width:32rem;margin:auto">` +
      `<h1>Login fehlgeschlagen</h1><p>${safe}</p>` +
      `<p><a href="/auth/login">Erneut versuchen</a> oder <a href="/">zurück</a>.</p></main>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}
