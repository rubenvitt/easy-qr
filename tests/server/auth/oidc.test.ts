import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDiscovery, __resetDiscoveryCache } from '../../../src/lib/server/auth/oidc';

beforeEach(() => __resetDiscoveryCache());

describe('fetchDiscovery', () => {
  it('caches per issuer', async () => {
    const spy = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            authorization_endpoint: 'https://id.example/auth',
            token_endpoint: 'https://id.example/token',
            userinfo_endpoint: 'https://id.example/userinfo'
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    );
    const a = await fetchDiscovery('https://id.example', spy as unknown as typeof fetch);
    const b = await fetchDiscovery('https://id.example', spy as unknown as typeof fetch);
    expect(a).toBe(b);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('throws on non-200', async () => {
    const spy = vi.fn(async () => new Response('boom', { status: 500 }));
    await expect(
      fetchDiscovery('https://x.example', spy as unknown as typeof fetch)
    ).rejects.toThrow(/discovery/i);
  });
});
