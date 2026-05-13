import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export function startOidcMock(port = 4787) {
  const ISSUER = `http://localhost:${port}`;
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const u = new URL(req.url ?? '', ISSUER);
    if (u.pathname === '/.well-known/openid-configuration') {
      return json(res, 200, {
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/auth`,
        token_endpoint: `${ISSUER}/token`,
        userinfo_endpoint: `${ISSUER}/userinfo`,
        end_session_endpoint: `${ISSUER}/logout`
      });
    }
    if (u.pathname === '/auth') {
      const redirect = u.searchParams.get('redirect_uri')!;
      const state = u.searchParams.get('state')!;
      const cb = new URL(redirect);
      cb.searchParams.set('code', 'mock-code');
      cb.searchParams.set('state', state);
      res.writeHead(302, { Location: cb.toString() }).end();
      return;
    }
    if (u.pathname === '/token' && req.method === 'POST') {
      const payload = Buffer.from(
        JSON.stringify({
          sub: 'mock-sub',
          email: 'admin@test.de',
          name: 'Admin',
          groups: ['drk-qr-admin']
        })
      ).toString('base64url');
      return json(res, 200, {
        access_token: 'mock-access',
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: `eyJhbGciOiJub25lIn0.${payload}.`
      });
    }
    if (u.pathname === '/userinfo') {
      return json(res, 200, {
        sub: 'mock-sub',
        email: 'admin@test.de',
        name: 'Admin',
        groups: ['drk-qr-admin']
      });
    }
    res.writeHead(404).end();
  });
  return new Promise<{ url: string; stop: () => Promise<void> }>((resolve) =>
    server.listen(port, () =>
      resolve({
        url: ISSUER,
        stop: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          })
      })
    )
  );
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}
