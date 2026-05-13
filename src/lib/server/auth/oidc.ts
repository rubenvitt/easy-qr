import {
  OAuth2Client,
  CodeChallengeMethod,
  generateState,
  generateCodeVerifier,
  decodeIdToken
} from 'arctic';

export interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint?: string;
}

const cache = new Map<string, OidcDiscovery>();
const inflight = new Map<string, Promise<OidcDiscovery>>();

export function __resetDiscoveryCache() {
  cache.clear();
  inflight.clear();
}

type FetchFn = typeof fetch;

export async function fetchDiscovery(
  issuer: string,
  fetchFn: FetchFn = fetch
): Promise<OidcDiscovery> {
  const cached = cache.get(issuer);
  if (cached) return cached;
  const pending = inflight.get(issuer);
  if (pending) return pending;
  const url = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
  const promise = fetchFn(url).then(async (r) => {
    if (!r.ok) throw new Error(`OIDC discovery failed: ${r.status}`);
    const data = (await r.json()) as OidcDiscovery;
    cache.set(issuer, data);
    inflight.delete(issuer);
    return data;
  });
  inflight.set(issuer, promise);
  return promise;
}

export function buildOAuth2Client(env: {
  POCKET_ID_CLIENT_ID: string;
  POCKET_ID_CLIENT_SECRET: string;
  POCKET_ID_REDIRECT_URI: string;
}): OAuth2Client {
  return new OAuth2Client(
    env.POCKET_ID_CLIENT_ID,
    env.POCKET_ID_CLIENT_SECRET,
    env.POCKET_ID_REDIRECT_URI
  );
}

export const OIDC_SCOPES = ['openid', 'profile', 'email', 'groups'];

export async function fetchUserInfo(
  discovery: OidcDiscovery,
  accessToken: string,
  fetchFn: FetchFn = fetch
): Promise<Record<string, unknown>> {
  const res = await fetchFn(discovery.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error(`UserInfo failed: ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export { CodeChallengeMethod, generateState, generateCodeVerifier, decodeIdToken };
