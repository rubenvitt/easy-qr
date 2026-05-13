import { type RequestHandler } from '@sveltejs/kit';
import { requireEnv } from '$lib/server/db';
import {
  buildOAuth2Client,
  fetchDiscovery,
  generateCodeVerifier,
  generateState,
  CodeChallengeMethod,
  OIDC_SCOPES
} from '$lib/server/auth/oidc';
import {
  OIDC_STATE_COOKIE,
  OIDC_VERIFIER_COOKIE,
  OIDC_RETURN_COOKIE,
  serializeTransientCookie
} from '$lib/server/auth/cookies';
import { sanitizeReturnUrl } from '$lib/server/auth/return-url';

export const prerender = false;

export const GET: RequestHandler = async ({ url, platform }) => {
  const issuer = requireEnv(platform, 'POCKET_ID_ISSUER');
  const discovery = await fetchDiscovery(issuer);
  const client = buildOAuth2Client({
    POCKET_ID_CLIENT_ID: requireEnv(platform, 'POCKET_ID_CLIENT_ID'),
    POCKET_ID_CLIENT_SECRET: requireEnv(platform, 'POCKET_ID_CLIENT_SECRET'),
    POCKET_ID_REDIRECT_URI: requireEnv(platform, 'POCKET_ID_REDIRECT_URI')
  });
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const returnTo = sanitizeReturnUrl(url.searchParams.get('return'));

  const authUrl = client.createAuthorizationURLWithPKCE(
    discovery.authorization_endpoint,
    state,
    CodeChallengeMethod.S256,
    codeVerifier,
    OIDC_SCOPES
  );

  const headers = new Headers({ Location: authUrl.toString() });
  headers.append('Set-Cookie', serializeTransientCookie(OIDC_STATE_COOKIE, state));
  headers.append('Set-Cookie', serializeTransientCookie(OIDC_VERIFIER_COOKIE, codeVerifier));
  headers.append('Set-Cookie', serializeTransientCookie(OIDC_RETURN_COOKIE, returnTo));
  return new Response(null, { status: 302, headers });
};
