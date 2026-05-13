# Backend & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migriere die Presets aus dem Repo in eine Cloudflare D1 Datenbank, geschützt durch Pocket ID Login, und füge eine Admin-UI für die Pflege hinzu — ohne die anonyme QR-Generierung zu blockieren.

**Architecture:** Adapter-Wechsel von `adapter-static` zu `adapter-cloudflare` (Hybrid: statische Routes prerendered, dynamische als Worker-Endpoints). Auth läuft über Pocket ID OIDC (`arctic`), Sessions als signed HttpOnly-Cookies mit Lookup in D1-Tabelle. Presets werden über JSON-API gelesen/geschrieben; Frontend-Store hält Auth-State, Service-Worker cached `/api/presets` mit NetworkFirst.

**Tech Stack:** SvelteKit 2 (Svelte 5) · `@sveltejs/adapter-cloudflare` · Cloudflare D1 · `arctic` (OIDC) · Web Crypto API (signierte Cookies) · `@cloudflare/vitest-pool-workers` (Integrationstests) · Playwright (E2E) · Wrangler (Local Dev) · vite-plugin-pwa (Workbox runtime caching)

---

## File Structure

**Neue Dateien:**

- `wrangler.toml`, `.dev.vars.example`, `.gitignore` (Erweiterung)
- `migrations/0001_init.sql`, `migrations/0002_seed_demo_preset.sql`
- `src/lib/server/db.ts` — D1-Binding-Helper
- `src/lib/server/crypto.ts` — HMAC + base64url (Web Crypto)
- `src/lib/server/auth/cookies.ts` — signierte Session + Transient Cookies
- `src/lib/server/auth/sessions.ts` — Session-Repository
- `src/lib/server/auth/oidc.ts` — arctic-Client + Discovery-Cache
- `src/lib/server/auth/return-url.ts` — Open-Redirect-Schutz
- `src/lib/server/auth/role-mapping.ts` — Pocket-ID-Gruppen → Rolle
- `src/lib/server/auth/users.ts` — User-Upsert
- `src/lib/server/presets/slug.ts`, `validator.ts`, `repo.ts`
- `src/hooks.server.ts` — Session-Load aus Cookie
- `src/routes/+layout.server.ts` — User an Client weiterreichen
- `src/lib/stores/auth.ts` — Client-Store
- `src/routes/auth/login/+server.ts`, `auth/callback/+server.ts`, `auth/logout/+server.ts`
- `src/routes/api/me/+server.ts`
- `src/routes/api/presets/+server.ts` (GET, POST)
- `src/routes/api/presets/[id]/+server.ts` (PUT, DELETE)
- `src/routes/api/presets/reorder/+server.ts` (POST)
- `src/routes/admin/+page.server.ts`, `+page.svelte`, `PresetForm.svelte`
- `tests/server/auth/*.test.ts`, `tests/server/presets/*.test.ts`, `tests/server/api/*.test.ts`
- `tests/helpers/fake-d1.ts` — In-Memory-SQLite-Fake
- `tests/e2e/auth-admin-flow.spec.ts`, `tests/e2e/_oidc-mock.ts`
- `vitest.workers.config.ts`

**Geänderte Dateien:**

- `package.json`, `svelte.config.js`, `vite.config.ts`
- `src/app.d.ts`, `src/routes/+layout.ts`, `src/routes/+layout.svelte`
- `src/routes/+page.svelte`, `src/lib/presets.ts`
- `playwright.config.ts`, `README.md`, `.gitignore`

**Zu löschende Dateien:** `scripts/validate-presets.ts`, `src/data/presets.json`

---

## Task 1: Adapter-Wechsel und Wrangler-Bootstrap

**Files:**
- Modify: `package.json`, `svelte.config.js`, `.gitignore`, `src/app.d.ts`, `src/routes/+layout.ts`
- Create: `wrangler.toml`, `.dev.vars.example`

- [ ] **Step 1: Adapter-Pakete tauschen**

```bash
pnpm remove @sveltejs/adapter-static @sveltejs/adapter-auto
pnpm add -D @sveltejs/adapter-cloudflare wrangler @cloudflare/workers-types
```

- [ ] **Step 2: `svelte.config.js`**

```js
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      routes: { include: ['/*'], exclude: ['<all>'] }
    })
  }
};

export default config;
```

- [ ] **Step 3: `wrangler.toml` anlegen**

```toml
name = "drk-qr-generator"
compatibility_date = "2026-05-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".svelte-kit/cloudflare"

[[d1_databases]]
binding = "DB"
database_name = "drk-qr-presets"
database_id = "00000000-0000-0000-0000-000000000000"
migrations_dir = "migrations"
```

Hinweis: `database_id` wird nach `pnpm wrangler d1 create drk-qr-presets` durch den echten Wert ersetzt.

- [ ] **Step 4: `.dev.vars.example`**

```
POCKET_ID_ISSUER=https://id.drk-xy.de
POCKET_ID_CLIENT_ID=replace-me
POCKET_ID_CLIENT_SECRET=replace-me
POCKET_ID_REDIRECT_URI=http://localhost:5173/auth/callback
SESSION_SECRET=replace-with-32-bytes-hex
APP_ORIGIN=http://localhost:5173
```

- [ ] **Step 5: `.gitignore` ergänzen**

Anhängen:
```
.dev.vars
.wrangler/
```

- [ ] **Step 6: `src/app.d.ts`**

```ts
/// <reference types="@cloudflare/workers-types" />

declare global {
  namespace App {
    interface Error {}
    interface Locals {
      user: {
        id: string;
        email: string;
        displayName: string | null;
        role: 'user' | 'admin';
      } | null;
      sessionId: string | null;
    }
    interface PageData {
      user: App.Locals['user'];
    }
    interface Platform {
      env: {
        DB: D1Database;
        POCKET_ID_ISSUER: string;
        POCKET_ID_CLIENT_ID: string;
        POCKET_ID_CLIENT_SECRET: string;
        POCKET_ID_REDIRECT_URI: string;
        SESSION_SECRET: string;
        APP_ORIGIN: string;
      };
      context: { waitUntil(p: Promise<unknown>): void };
      caches: CacheStorage & { default: Cache };
    }
  }
}

export {};
```

- [ ] **Step 7: `src/routes/+layout.ts`**

```ts
export const prerender = 'auto';
export const ssr = false;
```

(Dynamische Routen setzen explizit `export const prerender = false;`.)

- [ ] **Step 8: Typecheck**

Run: `pnpm check`
Expected: keine Fehler.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml svelte.config.js wrangler.toml .dev.vars.example .gitignore src/app.d.ts src/routes/+layout.ts
git commit -m "chore(adapter): switch to adapter-cloudflare with D1 binding"
```

---

## Task 2: D1-Schema und Migrationen

**Files:**
- Create: `migrations/0001_init.sql`, `migrations/0002_seed_demo_preset.sql`

- [ ] **Step 1: Schema**

`migrations/0001_init.sql`:
```sql
CREATE TABLE presets (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('url','wifi','tel','vcard','text')),
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE INDEX idx_presets_sort ON presets (sort_order, label);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('user','admin')),
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);
```

- [ ] **Step 2: Demo-Seed (keine Echt-Daten)**

`migrations/0002_seed_demo_preset.sql`:
```sql
INSERT INTO presets (id, label, icon, kind, value, sort_order, created_at, updated_at, created_by, updated_by)
VALUES (
  'demo-url',
  'Beispiel-Link',
  '🔗',
  'url',
  '"https://www.drk.de"',
  0,
  1747094400000,
  1747094400000,
  'system',
  'system'
);
```

- [ ] **Step 3: Lokal anwenden**

```bash
pnpm wrangler d1 create drk-qr-presets || true
# database_id aus der Ausgabe in wrangler.toml übernehmen
pnpm wrangler d1 migrations apply drk-qr-presets --local
```
Expected: `✔ Successfully applied 2 migrations`.

- [ ] **Step 4: Commit**

```bash
git add migrations/ wrangler.toml
git commit -m "feat(db): add D1 schema and demo seed migration"
```

---

## Task 3: Crypto-Helper (TDD)

**Files:**
- Create: `src/lib/server/crypto.ts`
- Create: `tests/server/auth/crypto.test.ts`

- [ ] **Step 1: Test schreiben**

```ts
import { describe, it, expect } from 'vitest';
import { hmacSign, hmacVerify, toBase64Url, fromBase64Url, randomHex } from '../../../src/lib/server/crypto';

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
```

- [ ] **Step 2: FAIL**

Run: `pnpm test tests/server/auth/crypto.test.ts` → Modul fehlt.

- [ ] **Step 3: Implementierung**

`src/lib/server/crypto.ts`:
```ts
const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return toBase64Url(sig);
}

export async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const key = await importKey(secret);
  try {
    return await crypto.subtle.verify('HMAC', key, fromBase64Url(signature), encoder.encode(payload));
  } catch {
    return false;
  }
}

export function randomHex(byteCount: number): string {
  const buf = new Uint8Array(byteCount);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 4: grün, Commit**

```bash
pnpm test tests/server/auth/crypto.test.ts
git add src/lib/server/crypto.ts tests/server/auth/crypto.test.ts
git commit -m "feat(server): add HMAC + base64url crypto helpers"
```

---

## Task 4: Cookie-Helper (TDD)

**Files:**
- Create: `src/lib/server/auth/cookies.ts`
- Create: `tests/server/auth/cookies.test.ts`

- [ ] **Step 1: Tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  buildSignedCookieValue,
  parseSignedCookieValue,
  serializeSessionCookie,
  serializeClearedSessionCookie,
  serializeTransientCookie,
  readCookie,
  SESSION_COOKIE
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
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implementierung**

`src/lib/server/auth/cookies.ts`:
```ts
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
```

- [ ] **Step 4: grün, Commit**

```bash
pnpm test tests/server/auth/cookies.test.ts
git add src/lib/server/auth/cookies.ts tests/server/auth/cookies.test.ts
git commit -m "feat(auth): signed cookie + transient cookie helpers"
```

---

## Task 5: Fake-D1-Helper für Unit-Tests

**Files:**
- Create: `tests/helpers/fake-d1.ts`
- Modify: `package.json` (better-sqlite3 als dev-dep)

- [ ] **Step 1: Dependency**

```bash
pnpm add -D better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 2: Fake-D1 anlegen**

`tests/helpers/fake-d1.ts`:
```ts
import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
}

function splitSql(sql: string): string[] {
  return sql
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createFakeD1(): { db: D1Database; raw: Database.Database } {
  const sqlite = new Database(':memory:');
  const dir = join(process.cwd(), 'migrations');
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.sql')) continue;
    const raw = readFileSync(join(dir, file), 'utf8');
    for (const stmt of splitSql(raw)) sqlite.prepare(stmt).run();
  }
  const db: D1Database = {
    prepare(sql: string): D1PreparedStatement {
      const stmt = sqlite.prepare(sql);
      const params: unknown[] = [];
      const api: D1PreparedStatement = {
        bind(...values) {
          params.push(...values);
          return api;
        },
        async first() {
          return (stmt.get(...(params as any[])) ?? null) as any;
        },
        async all() {
          return { results: stmt.all(...(params as any[])) as any[] };
        },
        async run() {
          const info = stmt.run(...(params as any[]));
          return { success: true, meta: { changes: info.changes } };
        }
      };
      return api;
    },
    async batch(stmts: any[]) {
      const out: any[] = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    }
  } as unknown as D1Database;
  return { db, raw: sqlite };
}
```

- [ ] **Step 3: Smoke-Test**

Schreibe schnellen Test `tests/helpers/fake-d1.smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createFakeD1 } from './fake-d1';

describe('fake-d1', () => {
  it('runs migrations and seeds demo-url', async () => {
    const { db } = createFakeD1();
    const row = await db.prepare(`SELECT id FROM presets WHERE id = ?`).bind('demo-url').first<{ id: string }>();
    expect(row?.id).toBe('demo-url');
  });
});
```

Run: `pnpm test tests/helpers/fake-d1.smoke.test.ts` → PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/helpers/fake-d1.ts tests/helpers/fake-d1.smoke.test.ts package.json pnpm-lock.yaml
git commit -m "test: in-memory D1 fake for unit tests"
```

---

## Task 6: Session-Repository (TDD)

**Files:**
- Create: `src/lib/server/auth/sessions.ts`
- Create: `tests/server/auth/sessions.test.ts`

- [ ] **Step 1: Tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '../../helpers/fake-d1';
import {
  createSession,
  validateSession,
  deleteSession,
  SESSION_TTL_SECONDS
} from '../../../src/lib/server/auth/sessions';

let db: D1Database;
beforeEach(async () => {
  db = createFakeD1().db;
  await db
    .prepare(
      `INSERT INTO users (id, email, display_name, role, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind('u1', 'a@b.de', 'A B', 'admin', 0, 0)
    .run();
});

describe('sessions', () => {
  it('creates and validates', async () => {
    const sid = await createSession(db, 'u1');
    const result = await validateSession(db, sid);
    expect(result?.user.id).toBe('u1');
    expect(result?.user.role).toBe('admin');
  });

  it('returns null for unknown session', async () => {
    expect(await validateSession(db, 'nope')).toBeNull();
  });

  it('returns null and deletes expired sessions', async () => {
    await db
      .prepare(`INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
      .bind('expired', 'u1', Date.now() - 1000, Date.now() - 10000)
      .run();
    expect(await validateSession(db, 'expired')).toBeNull();
    const row = await db.prepare(`SELECT id FROM sessions WHERE id = ?`).bind('expired').first();
    expect(row).toBeNull();
  });

  it('deleteSession removes the row', async () => {
    const sid = await createSession(db, 'u1');
    await deleteSession(db, sid);
    expect(await validateSession(db, sid)).toBeNull();
  });

  it('TTL is 7 days', () => {
    expect(SESSION_TTL_SECONDS).toBe(60 * 60 * 24 * 7);
  });
});
```

- [ ] **Step 2: FAIL.**

- [ ] **Step 3: Implementierung**

`src/lib/server/auth/sessions.ts`:
```ts
import { randomHex } from '../crypto';

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';
}

export interface SessionValidation {
  sessionId: string;
  user: SessionUser;
}

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const id = randomHex(32);
  const now = Date.now();
  await db
    .prepare(`INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
    .bind(id, userId, now + SESSION_TTL_SECONDS * 1000, now)
    .run();
  return id;
}

export async function validateSession(
  db: D1Database,
  sessionId: string
): Promise<SessionValidation | null> {
  const row = await db
    .prepare(
      `SELECT s.id AS sid, s.expires_at AS exp, u.id AS uid, u.email, u.display_name AS displayName, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .bind(sessionId)
    .first<{
      sid: string;
      exp: number;
      uid: string;
      email: string;
      displayName: string | null;
      role: 'user' | 'admin';
    }>();
  if (!row) return null;
  if (row.exp < Date.now()) {
    await deleteSession(db, sessionId);
    return null;
  }
  return {
    sessionId: row.sid,
    user: { id: row.uid, email: row.email, displayName: row.displayName, role: row.role }
  };
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
}

export async function deleteAllSessionsForUser(db: D1Database, userId: string): Promise<void> {
  await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();
}
```

- [ ] **Step 4: grün, Commit**

```bash
pnpm test tests/server/auth/sessions.test.ts
git add src/lib/server/auth/sessions.ts tests/server/auth/sessions.test.ts
git commit -m "feat(auth): session repository with TTL handling"
```

---

## Task 7: Role-Mapping (TDD)

**Files:**
- Create: `src/lib/server/auth/role-mapping.ts`
- Create: `tests/server/auth/role-mapping.test.ts`

- [ ] **Step 1: Tests**

```ts
import { describe, it, expect } from 'vitest';
import { mapRoleFromGroups, NoRoleError } from '../../../src/lib/server/auth/role-mapping';

describe('mapRoleFromGroups', () => {
  it('admin wins over user', () => {
    expect(mapRoleFromGroups(['drk-qr-user', 'drk-qr-admin'])).toBe('admin');
  });
  it('maps drk-qr-user to user', () => {
    expect(mapRoleFromGroups(['drk-qr-user'])).toBe('user');
  });
  it('throws on empty', () => {
    expect(() => mapRoleFromGroups([])).toThrow(NoRoleError);
  });
  it('throws on unrelated groups', () => {
    expect(() => mapRoleFromGroups(['x'])).toThrow(NoRoleError);
  });
  it('throws on non-array', () => {
    expect(() => mapRoleFromGroups(undefined as unknown as string[])).toThrow(NoRoleError);
  });
});
```

- [ ] **Step 2: Implementierung**

`src/lib/server/auth/role-mapping.ts`:
```ts
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
```

- [ ] **Step 3: Tests grün, Commit**

```bash
pnpm test tests/server/auth/role-mapping.test.ts
git add src/lib/server/auth/role-mapping.ts tests/server/auth/role-mapping.test.ts
git commit -m "feat(auth): map Pocket ID groups to user/admin roles"
```

---

## Task 8: Return-URL-Allowlist (TDD)

**Files:**
- Create: `src/lib/server/auth/return-url.ts`
- Create: `tests/server/auth/return-url.test.ts`

- [ ] **Step 1: Tests**

```ts
import { describe, it, expect } from 'vitest';
import { sanitizeReturnUrl } from '../../../src/lib/server/auth/return-url';

describe('sanitizeReturnUrl', () => {
  it('accepts internal path', () => expect(sanitizeReturnUrl('/admin')).toBe('/admin'));
  it('accepts root', () => expect(sanitizeReturnUrl('/')).toBe('/'));
  it('rejects protocol-relative', () => expect(sanitizeReturnUrl('//evil.com')).toBe('/'));
  it('rejects absolute external', () => expect(sanitizeReturnUrl('https://evil.com/x')).toBe('/'));
  it('rejects null', () => expect(sanitizeReturnUrl(null)).toBe('/'));
  it('rejects header injection', () =>
    expect(sanitizeReturnUrl('/admin\nset-cookie: x')).toBe('/'));
});
```

- [ ] **Step 2: Implementierung**

`src/lib/server/auth/return-url.ts`:
```ts
export function sanitizeReturnUrl(raw: string | null): string {
  if (!raw) return '/';
  if (raw.startsWith('//')) return '/';
  if (raw.includes('\n') || raw.includes('\r')) return '/';
  if (!raw.startsWith('/')) return '/';
  return raw;
}
```

- [ ] **Step 3: Tests grün, Commit**

```bash
pnpm test tests/server/auth/return-url.test.ts
git add src/lib/server/auth/return-url.ts tests/server/auth/return-url.test.ts
git commit -m "feat(auth): sanitizeReturnUrl allowlist helper"
```

---

## Task 9: User-Upsert (TDD)

**Files:**
- Create: `src/lib/server/auth/users.ts`
- Create: `tests/server/auth/users.test.ts`

- [ ] **Step 1: Tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '../../helpers/fake-d1';
import { upsertUser } from '../../../src/lib/server/auth/users';

let db: D1Database;
beforeEach(() => (db = createFakeD1().db));

describe('upsertUser', () => {
  it('inserts a new user', async () => {
    await upsertUser(db, { sub: 'sub-1', email: 'a@b.de', name: 'Anne', role: 'admin' });
    const row = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind('sub-1').first<any>();
    expect(row.email).toBe('a@b.de');
    expect(row.role).toBe('admin');
    expect(row.last_login_at).toBeGreaterThan(0);
  });

  it('updates fields + last_login on second login', async () => {
    await upsertUser(db, { sub: 'sub-1', email: 'a@b.de', name: 'A', role: 'user' });
    const first = await db.prepare(`SELECT last_login_at FROM users WHERE id = ?`).bind('sub-1').first<any>();
    await new Promise((r) => setTimeout(r, 5));
    await upsertUser(db, { sub: 'sub-1', email: 'c@d.de', name: 'C', role: 'admin' });
    const row = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind('sub-1').first<any>();
    expect(row.email).toBe('c@d.de');
    expect(row.role).toBe('admin');
    expect(row.last_login_at).toBeGreaterThan(first.last_login_at);
  });
});
```

- [ ] **Step 2: Implementierung**

`src/lib/server/auth/users.ts`:
```ts
import type { Role } from './role-mapping';

export interface OidcClaims {
  sub: string;
  email: string;
  name?: string | null;
  role: Role;
}

export async function upsertUser(db: D1Database, claims: OidcClaims): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO users (id, email, display_name, role, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         display_name = excluded.display_name,
         role = excluded.role,
         last_login_at = excluded.last_login_at`
    )
    .bind(claims.sub, claims.email, claims.name ?? null, claims.role, now, now)
    .run();
}
```

- [ ] **Step 3: Tests grün, Commit**

```bash
pnpm test tests/server/auth/users.test.ts
git add src/lib/server/auth/users.ts tests/server/auth/users.test.ts
git commit -m "feat(auth): upsert user record on every login"
```

---

## Task 10: OIDC-Client + Discovery-Cache

**Files:**
- Create: `src/lib/server/auth/oidc.ts`
- Create: `tests/server/auth/oidc.test.ts`

- [ ] **Step 1: arctic installieren**

```bash
pnpm add arctic
```

- [ ] **Step 2: Tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDiscovery, __resetDiscoveryCache } from '../../../src/lib/server/auth/oidc';

beforeEach(() => __resetDiscoveryCache());

describe('fetchDiscovery', () => {
  it('caches per issuer', async () => {
    const spy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          authorization_endpoint: 'https://id.example/auth',
          token_endpoint: 'https://id.example/token',
          userinfo_endpoint: 'https://id.example/userinfo'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    const a = await fetchDiscovery('https://id.example', spy as any);
    const b = await fetchDiscovery('https://id.example', spy as any);
    expect(a).toBe(b);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('throws on non-200', async () => {
    const spy = vi.fn(async () => new Response('boom', { status: 500 }));
    await expect(fetchDiscovery('https://x.example', spy as any)).rejects.toThrow(/discovery/i);
  });
});
```

- [ ] **Step 3: Implementierung**

`src/lib/server/auth/oidc.ts`:
```ts
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

export async function fetchDiscovery(issuer: string, fetchFn: FetchFn = fetch): Promise<OidcDiscovery> {
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
```

- [ ] **Step 4: Tests grün, Commit**

```bash
pnpm test tests/server/auth/oidc.test.ts
git add src/lib/server/auth/oidc.ts tests/server/auth/oidc.test.ts package.json pnpm-lock.yaml
git commit -m "feat(auth): arctic OIDC client + discovery cache"
```

---

## Task 11: DB-Helper + `hooks.server.ts`

**Files:**
- Create: `src/lib/server/db.ts`, `src/hooks.server.ts`

- [ ] **Step 1: `src/lib/server/db.ts`**

```ts
export function requireDb(platform: App.Platform | undefined): D1Database {
  if (!platform?.env?.DB) {
    throw new Error('D1 binding "DB" is not available. Run via wrangler/pnpm dev.');
  }
  return platform.env.DB;
}

export function requireEnv<K extends keyof App.Platform['env']>(
  platform: App.Platform | undefined,
  key: K
): App.Platform['env'][K] {
  const v = platform?.env?.[key];
  if (v === undefined || v === null || v === '') {
    throw new Error(`Missing env: ${String(key)}`);
  }
  return v;
}
```

- [ ] **Step 2: `src/hooks.server.ts`**

```ts
import type { Handle } from '@sveltejs/kit';
import { requireDb, requireEnv } from '$lib/server/db';
import { readCookie, SESSION_COOKIE, parseSignedCookieValue } from '$lib/server/auth/cookies';
import { validateSession } from '$lib/server/auth/sessions';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  event.locals.sessionId = null;

  try {
    const raw = readCookie(event.request.headers.get('cookie'), SESSION_COOKIE);
    if (raw) {
      const secret = requireEnv(event.platform, 'SESSION_SECRET');
      const sid = await parseSignedCookieValue(raw, secret);
      if (sid) {
        const db = requireDb(event.platform);
        const result = await validateSession(db, sid);
        if (result) {
          event.locals.user = result.user;
          event.locals.sessionId = result.sessionId;
        }
      }
    }
  } catch (err) {
    console.error('hooks.server: session load failed', err);
  }

  return resolve(event);
};
```

- [ ] **Step 3: Typecheck + Commit**

```bash
pnpm check
git add src/lib/server/db.ts src/hooks.server.ts
git commit -m "feat(server): load user from signed session cookie in hooks"
```

---

## Task 12: `/auth/login` Route

**Files:**
- Create: `src/routes/auth/login/+server.ts`

- [ ] **Step 1: Endpoint**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
pnpm check
git add src/routes/auth/login/+server.ts
git commit -m "feat(auth): start OIDC PKCE flow in /auth/login"
```

---

## Task 13: `/auth/callback` Route

**Files:**
- Create: `src/routes/auth/callback/+server.ts`

- [ ] **Step 1: Endpoint**

```ts
import { type RequestHandler } from '@sveltejs/kit';
import { requireDb, requireEnv } from '$lib/server/db';
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
import { mapRoleFromGroups, NoRoleError } from '$lib/server/auth/role-mapping';
import { upsertUser } from '$lib/server/auth/users';
import { createSession, SESSION_TTL_SECONDS } from '$lib/server/auth/sessions';
import { sanitizeReturnUrl } from '$lib/server/auth/return-url';

export const prerender = false;

export const GET: RequestHandler = async ({ url, request, platform }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (url.searchParams.get('error')) return errorPage(`OIDC-Fehler: ${url.searchParams.get('error')}`, 400);
  if (!code || !state) return errorPage('Fehlende Parameter', 400);

  const cookieHeader = request.headers.get('cookie');
  const storedState = readCookie(cookieHeader, OIDC_STATE_COOKIE);
  const verifier = readCookie(cookieHeader, OIDC_VERIFIER_COOKIE);
  const returnTo = readCookie(cookieHeader, OIDC_RETURN_COOKIE) ?? '/';
  if (!storedState || !verifier || storedState !== state) {
    return errorPage('State stimmt nicht überein', 400);
  }

  const issuer = requireEnv(platform, 'POCKET_ID_ISSUER');
  const discovery = await fetchDiscovery(issuer);
  const client = buildOAuth2Client({
    POCKET_ID_CLIENT_ID: requireEnv(platform, 'POCKET_ID_CLIENT_ID'),
    POCKET_ID_CLIENT_SECRET: requireEnv(platform, 'POCKET_ID_CLIENT_SECRET'),
    POCKET_ID_REDIRECT_URI: requireEnv(platform, 'POCKET_ID_REDIRECT_URI')
  });

  let tokens;
  try {
    tokens = await client.validateAuthorizationCode(discovery.token_endpoint, code, verifier);
  } catch {
    return errorPage('Token-Tausch fehlgeschlagen', 400);
  }

  let userInfo: Record<string, unknown> = {};
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
    role = mapRoleFromGroups(groups);
  } catch (e) {
    if (e instanceof NoRoleError) return errorPage('Kein Zugriff — bitte Admin kontaktieren', 403);
    throw e;
  }

  const db = requireDb(platform);
  await upsertUser(db, { sub, email, name, role });
  const sessionId = await createSession(db, sub);

  const cookie = await serializeSessionCookie(
    sessionId,
    requireEnv(platform, 'SESSION_SECRET'),
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
  const safe = msg.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Login fehlgeschlagen</title>` +
      `<main style="font:16px system-ui;padding:2rem;max-width:32rem;margin:auto">` +
      `<h1>Login fehlgeschlagen</h1><p>${safe}</p>` +
      `<p><a href="/auth/login">Erneut versuchen</a> oder <a href="/">zurück</a>.</p></main>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}
```

- [ ] **Step 2: Typecheck, Commit**

```bash
pnpm check
git add src/routes/auth/callback/+server.ts
git commit -m "feat(auth): OIDC callback handler, create session"
```

---

## Task 14: `/auth/logout` Route

**Files:**
- Create: `src/routes/auth/logout/+server.ts`

- [ ] **Step 1: Endpoint**

```ts
import { type RequestHandler } from '@sveltejs/kit';
import { requireDb } from '$lib/server/db';
import { deleteSession } from '$lib/server/auth/sessions';
import { serializeClearedSessionCookie } from '$lib/server/auth/cookies';

export const prerender = false;

export const POST: RequestHandler = async ({ locals, platform, request }) => {
  const origin = request.headers.get('origin');
  const appOrigin = platform?.env?.APP_ORIGIN;
  if (origin && appOrigin && origin !== appOrigin) {
    return new Response('Forbidden', { status: 403 });
  }
  if (locals.sessionId && platform) {
    await deleteSession(requireDb(platform), locals.sessionId);
  }
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': serializeClearedSessionCookie() }
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/auth/logout/+server.ts
git commit -m "feat(auth): /auth/logout deletes session + clears cookie"
```

---

## Task 15: `/api/me` + `+layout.server.ts`

**Files:**
- Create: `src/routes/api/me/+server.ts`, `src/routes/+layout.server.ts`

- [ ] **Step 1: `/api/me`**

```ts
import { json, type RequestHandler } from '@sveltejs/kit';

export const prerender = false;

export const GET: RequestHandler = ({ locals }) =>
  json({ user: locals.user }, { headers: { 'Cache-Control': 'private, no-store' } });
```

- [ ] **Step 2: `+layout.server.ts`**

```ts
import type { LayoutServerLoad } from './$types';

export const prerender = false;
export const ssr = false;

export const load: LayoutServerLoad = ({ locals }) => ({ user: locals.user });
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/me/+server.ts src/routes/+layout.server.ts
git commit -m "feat(auth): expose current user via /api/me and layout load"
```

---

## Task 16: Slug-Helper (TDD)

**Files:**
- Create: `src/lib/server/presets/slug.ts`, `tests/server/presets/slug.test.ts`

- [ ] **Step 1: Tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '../../helpers/fake-d1';
import { slugify, uniqueSlug } from '../../../src/lib/server/presets/slug';

describe('slugify', () => {
  it('lowercases', () => expect(slugify('Hello World')).toBe('hello-world'));
  it('collapses special chars', () => expect(slugify('Beispiel — Link!')).toBe('beispiel-link'));
  it('transliterates umlauts', () =>
    expect(slugify('Übung WLAN für Süß')).toBe('uebung-wlan-fuer-suess'));
  it('falls back to "preset"', () => expect(slugify(' ')).toBe('preset'));
  it('truncates to 60', () => expect(slugify('a'.repeat(120)).length).toBe(60));
});

describe('uniqueSlug', () => {
  let db: D1Database;
  beforeEach(() => (db = createFakeD1().db));

  it('returns base when free', async () => {
    expect(await uniqueSlug(db, 'foo')).toBe('foo');
  });

  it('appends -2 on first collision', async () => {
    await db
      .prepare(
        `INSERT INTO presets (id,label,kind,value,sort_order,created_at,updated_at,created_by,updated_by)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .bind('foo', 'Foo', 'text', '""', 0, 0, 0, 'x', 'x')
      .run();
    expect(await uniqueSlug(db, 'foo')).toBe('foo-2');
  });

  it('walks until free', async () => {
    for (const id of ['bar', 'bar-2', 'bar-3']) {
      await db
        .prepare(
          `INSERT INTO presets (id,label,kind,value,sort_order,created_at,updated_at,created_by,updated_by)
           VALUES (?,?,?,?,?,?,?,?,?)`
        )
        .bind(id, id, 'text', '""', 0, 0, 0, 'x', 'x')
        .run();
    }
    expect(await uniqueSlug(db, 'bar')).toBe('bar-4');
  });
});
```

- [ ] **Step 2: Implementierung**

`src/lib/server/presets/slug.ts`:
```ts
const UMLAUT_MAP: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

export function slugify(input: string): string {
  const lower = input.toLowerCase();
  const transliterated = lower.replace(/[äöüß]/g, (c) => UMLAUT_MAP[c] ?? c);
  const slug = transliterated
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'preset';
}

export async function uniqueSlug(db: D1Database, base: string): Promise<string> {
  let candidate = base;
  let suffix = 2;
  while (true) {
    const row = await db.prepare(`SELECT 1 AS one FROM presets WHERE id = ?`).bind(candidate).first<{ one: number }>();
    if (!row) return candidate;
    candidate = `${base}-${suffix++}`;
    if (suffix > 1000) throw new Error('uniqueSlug: exhausted suffix space');
  }
}
```

- [ ] **Step 3: grün, Commit**

```bash
pnpm test tests/server/presets/slug.test.ts
git add src/lib/server/presets/slug.ts tests/server/presets/slug.test.ts
git commit -m "feat(presets): slugify + uniqueSlug helpers"
```

---

## Task 17: Server-seitiger Preset-Validator (TDD)

**Files:**
- Create: `src/lib/server/presets/validator.ts`, `tests/server/presets/validator.test.ts`

- [ ] **Step 1: Tests**

```ts
import { describe, it, expect } from 'vitest';
import { validatePresetInput } from '../../../src/lib/server/presets/validator';

describe('validatePresetInput', () => {
  it('accepts minimal url', () => {
    expect(validatePresetInput({ label: 'X', kind: 'url', value: 'https://x' }).ok).toBe(true);
  });
  it('rejects empty label', () => {
    expect(validatePresetInput({ label: '', kind: 'url', value: 'x' }).ok).toBe(false);
  });
  it('rejects label > 80', () => {
    expect(validatePresetInput({ label: 'a'.repeat(81), kind: 'url', value: 'x' }).ok).toBe(false);
  });
  it('rejects unknown kind', () => {
    expect(validatePresetInput({ label: 'X', kind: 'pikachu', value: 'x' }).ok).toBe(false);
  });
  it('rejects wifi without ssid', () => {
    expect(
      validatePresetInput({ label: 'X', kind: 'wifi', value: { encryption: 'WPA' } }).ok
    ).toBe(false);
  });
  it('accepts wifi with ssid', () => {
    expect(
      validatePresetInput({
        label: 'X',
        kind: 'wifi',
        value: { ssid: 'Net', password: 'p', encryption: 'WPA' }
      }).ok
    ).toBe(true);
  });
  it('rejects vcard without name', () => {
    expect(validatePresetInput({ label: 'X', kind: 'vcard', value: { tel: '+49' } }).ok).toBe(false);
  });
  it('rejects malformed slug id', () => {
    expect(validatePresetInput({ id: 'Foo Bar', label: 'X', kind: 'text', value: 'hi' }).ok).toBe(false);
  });
  it('accepts slug id', () => {
    expect(validatePresetInput({ id: 'foo-bar', label: 'X', kind: 'text', value: 'hi' }).ok).toBe(true);
  });
  it('rejects unknown wifi encryption', () => {
    expect(
      validatePresetInput({
        label: 'X',
        kind: 'wifi',
        value: { ssid: 'N', encryption: 'WPA3' }
      }).ok
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Implementierung**

`src/lib/server/presets/validator.ts`:
```ts
import type { Preset, QrKind } from '$lib/types';

export type ValidationResult =
  | { ok: true; value: Omit<Preset, 'id'> & { id?: string } }
  | { ok: false; error: string };

const VALID_KINDS: ReadonlyArray<QrKind> = ['url', 'wifi', 'tel', 'vcard', 'text'];
const ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

export function validatePresetInput(input: unknown): ValidationResult {
  if (typeof input !== 'object' || input === null) return fail('Body ist kein Objekt');
  const r = input as Record<string, unknown>;

  if (typeof r.label !== 'string' || r.label.trim() === '') return fail('label fehlt');
  if (r.label.length > 80) return fail('label > 80 Zeichen');
  if (typeof r.kind !== 'string' || !VALID_KINDS.includes(r.kind as QrKind))
    return fail(`kind ungültig: ${String(r.kind)}`);
  if (r.id !== undefined && (typeof r.id !== 'string' || !ID_RE.test(r.id)))
    return fail('id-Format ungültig');
  if (r.icon !== undefined && typeof r.icon !== 'string') return fail('icon muss string sein');

  const kind = r.kind as QrKind;
  const v = r.value;
  switch (kind) {
    case 'url':
    case 'tel':
    case 'text':
      if (typeof v !== 'string' || v === '') return fail(`${kind}.value muss nicht-leer sein`);
      break;
    case 'wifi': {
      if (typeof v !== 'object' || v === null) return fail('wifi.value muss object sein');
      const w = v as Record<string, unknown>;
      if (typeof w.ssid !== 'string' || w.ssid === '') return fail('wifi.ssid fehlt');
      if (w.password !== undefined && typeof w.password !== 'string')
        return fail('wifi.password muss string sein');
      if (!['WPA', 'WEP', 'nopass'].includes(w.encryption as string))
        return fail('wifi.encryption ungültig');
      if (w.hidden !== undefined && typeof w.hidden !== 'boolean')
        return fail('wifi.hidden muss boolean sein');
      break;
    }
    case 'vcard': {
      if (typeof v !== 'object' || v === null) return fail('vcard.value muss object sein');
      const c = v as Record<string, unknown>;
      if (typeof c.name !== 'string' || c.name === '') return fail('vcard.name fehlt');
      for (const k of ['tel', 'email', 'org']) {
        if (c[k] !== undefined && typeof c[k] !== 'string') return fail(`vcard.${k} muss string sein`);
      }
      break;
    }
  }

  return {
    ok: true,
    value: {
      id: r.id as string | undefined,
      label: r.label,
      icon: r.icon as string | undefined,
      kind,
      value: v
    } as ValidationResult['value']
  };
}

function fail(error: string): ValidationResult {
  return { ok: false, error };
}
```

- [ ] **Step 3: grün, Commit**

```bash
pnpm test tests/server/presets/validator.test.ts
git add src/lib/server/presets/validator.ts tests/server/presets/validator.test.ts
git commit -m "feat(presets): server-side preset validation"
```

---

## Task 18: Preset-Repository

**Files:**
- Create: `src/lib/server/presets/repo.ts`

- [ ] **Step 1: Implementierung**

```ts
import type { Preset, QrKind } from '$lib/types';

interface Row {
  id: string;
  label: string;
  icon: string | null;
  kind: QrKind;
  value: string;
  sort_order: number;
}

function rowToPreset(r: Row): Preset {
  return {
    id: r.id,
    label: r.label,
    icon: r.icon ?? undefined,
    kind: r.kind,
    value: JSON.parse(r.value)
  } as Preset;
}

export async function listPresets(db: D1Database): Promise<Preset[]> {
  const res = await db
    .prepare(`SELECT id, label, icon, kind, value, sort_order FROM presets ORDER BY sort_order, label`)
    .all<Row>();
  return res.results.map(rowToPreset);
}

export async function getPreset(db: D1Database, id: string): Promise<Preset | null> {
  const r = await db
    .prepare(`SELECT id, label, icon, kind, value, sort_order FROM presets WHERE id = ?`)
    .bind(id)
    .first<Row>();
  return r ? rowToPreset(r) : null;
}

export async function insertPreset(
  db: D1Database,
  data: { id: string; label: string; icon?: string; kind: QrKind; value: unknown },
  userId: string
): Promise<void> {
  const now = Date.now();
  const max = await db
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM presets`)
    .first<{ m: number }>();
  await db
    .prepare(
      `INSERT INTO presets (id, label, icon, kind, value, sort_order, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      data.id,
      data.label,
      data.icon ?? null,
      data.kind,
      JSON.stringify(data.value),
      (max?.m ?? -1) + 1,
      now,
      now,
      userId,
      userId
    )
    .run();
}

export async function updatePreset(
  db: D1Database,
  id: string,
  data: { label: string; icon?: string; kind: QrKind; value: unknown },
  userId: string
): Promise<boolean> {
  const now = Date.now();
  const res = await db
    .prepare(
      `UPDATE presets SET label = ?, icon = ?, kind = ?, value = ?, updated_at = ?, updated_by = ? WHERE id = ?`
    )
    .bind(data.label, data.icon ?? null, data.kind, JSON.stringify(data.value), now, userId, id)
    .run();
  return Boolean((res as { meta?: { changes?: number } }).meta?.changes);
}

export async function deletePreset(db: D1Database, id: string): Promise<boolean> {
  const res = await db.prepare(`DELETE FROM presets WHERE id = ?`).bind(id).run();
  return Boolean((res as { meta?: { changes?: number } }).meta?.changes);
}

export async function reorderPresets(db: D1Database, ids: string[]): Promise<void> {
  const stmts = ids.map((id, idx) =>
    db.prepare(`UPDATE presets SET sort_order = ? WHERE id = ?`).bind(idx, id)
  );
  const batch = (db as unknown as { batch?: (s: unknown[]) => Promise<unknown> }).batch;
  if (typeof batch === 'function') {
    await batch.call(db, stmts);
  } else {
    for (const s of stmts) await (s as { run: () => Promise<unknown> }).run();
  }
}
```

- [ ] **Step 2: Commit**

```bash
pnpm check
git add src/lib/server/presets/repo.ts
git commit -m "feat(presets): D1 repository with CRUD + reorder"
```

---

## Task 19: Integration-Tests-Setup (Vitest Workers Pool)

**Files:**
- Create: `vitest.workers.config.ts`
- Modify: `vitest.config.ts`, `package.json`

- [ ] **Step 1: Dependency**

```bash
pnpm add -D @cloudflare/vitest-pool-workers
```

- [ ] **Step 2: `vitest.workers.config.ts`**

```ts
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    include: ['tests/server/api/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          d1Databases: ['DB'],
          bindings: {
            POCKET_ID_ISSUER: 'https://id.test',
            POCKET_ID_CLIENT_ID: 'test',
            POCKET_ID_CLIENT_SECRET: 'test',
            POCKET_ID_REDIRECT_URI: 'http://localhost/auth/callback',
            SESSION_SECRET: 'e2e-secret-bytes-hex-xxxxxxxxxxxxx',
            APP_ORIGIN: 'http://localhost'
          }
        }
      }
    }
  }
});
```

- [ ] **Step 3: `vitest.config.ts` — Integrationspfad ausschließen**

Im bestehenden `test`-Block ergänzen:
```ts
test: {
  // ...bestehende Optionen
  exclude: ['node_modules/**', 'tests/server/api/**', 'tests/e2e/**']
}
```

- [ ] **Step 4: Scripts in `package.json`**

```json
"test:integration": "vitest run --config vitest.workers.config.ts",
"test:all": "pnpm test && pnpm test:integration"
```

- [ ] **Step 5: Commit**

```bash
git add vitest.workers.config.ts vitest.config.ts package.json pnpm-lock.yaml
git commit -m "test: add @cloudflare/vitest-pool-workers integration config"
```

---

## Task 20: API-Test-Helpers (`tests/server/api/_helpers.ts`)

**Files:**
- Create: `tests/server/api/_helpers.ts`

- [ ] **Step 1: Helper**

```ts
import { env } from 'cloudflare:test';
import { hmacSign } from '../../../src/lib/server/crypto';

export async function seedUserAndSession(role: 'user' | 'admin'): Promise<string> {
  const userId = `u-${crypto.randomUUID()}`;
  const sid = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO users (id, email, display_name, role, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(userId, `${userId}@x.de`, 'T', role, Date.now(), Date.now()).run();
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
  ).bind(sid, userId, Date.now() + 1e7, Date.now()).run();
  return sid;
}

export async function signCookie(sid: string): Promise<string> {
  return `drk_session=${sid}.${await hmacSign(sid, env.SESSION_SECRET as string)}`;
}
```

(Hinweis: Falls `SELF` / `env` Importe von `cloudflare:test` an aktuelle Pool-Worker-Doku angepasst werden müssen, dort ggf. `import { env, SELF } from 'cloudflare:test'`.)

- [ ] **Step 2: Commit**

```bash
git add tests/server/api/_helpers.ts
git commit -m "test(api): helpers for seeding session + signing cookie"
```

---

## Task 21: `GET /api/presets` + Integration-Test

**Files:**
- Create: `src/routes/api/presets/+server.ts` (zunächst nur GET)
- Create: `tests/server/api/presets-get.test.ts`

- [ ] **Step 1: Test**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF, applyD1Migrations } from 'cloudflare:test';
import { seedUserAndSession, signCookie } from './_helpers';

beforeAll(async () => {
  await applyD1Migrations(env.DB, (env as any).MIGRATIONS ?? '');
});

describe('GET /api/presets', () => {
  it('returns 401 for anonymous', async () => {
    const res = await SELF.fetch('http://localhost/api/presets');
    expect(res.status).toBe(401);
  });

  it('returns presets for an authenticated user', async () => {
    const sid = await seedUserAndSession('user');
    await env.DB.prepare(
      `INSERT INTO presets (id,label,kind,value,sort_order,created_at,updated_at,created_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind('p1', 'Eins', 'url', '"https://x"', 0, 0, 0, 'system', 'system').run();
    const res = await SELF.fetch('http://localhost/api/presets', {
      headers: { Cookie: await signCookie(sid) }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number; presets: Array<{ id: string }> };
    expect(body.version).toBe(1);
    expect(body.presets.map((p) => p.id)).toContain('p1');
  });
});
```

(Falls `applyD1Migrations` ein konkretes Migrations-Objekt benötigt, siehe `@cloudflare/vitest-pool-workers`-Doku — Pool-Setup wendet meist automatisch alle Migrationen aus `migrations_dir` an.)

- [ ] **Step 2: GET-Endpoint**

`src/routes/api/presets/+server.ts`:
```ts
import { json, type RequestHandler } from '@sveltejs/kit';
import { requireDb } from '$lib/server/db';
import { listPresets } from '$lib/server/presets/repo';

export const prerender = false;

export const GET: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  const presets = await listPresets(requireDb(platform));
  return json({ version: 1, presets }, { headers: { 'Cache-Control': 'private, max-age=60' } });
};
```

- [ ] **Step 3: Tests grün, Commit**

```bash
pnpm test:integration
git add src/routes/api/presets/+server.ts tests/server/api/presets-get.test.ts
git commit -m "feat(api): GET /api/presets with auth check"
```

---

## Task 22: `POST /api/presets` (Admin) + Integration-Test

**Files:**
- Modify: `src/routes/api/presets/+server.ts`
- Create: `tests/server/api/presets-post.test.ts`

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';
import { seedUserAndSession, signCookie } from './_helpers';

describe('POST /api/presets', () => {
  it('401 for anonymous', async () => {
    const res = await SELF.fetch('http://localhost/api/presets', { method: 'POST', body: '{}' });
    expect(res.status).toBe(401);
  });

  it('403 for non-admin', async () => {
    const sid = await seedUserAndSession('user');
    const res = await SELF.fetch('http://localhost/api/presets', {
      method: 'POST',
      headers: { Cookie: await signCookie(sid), 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'X', kind: 'text', value: 'hi' })
    });
    expect(res.status).toBe(403);
  });

  it('admin creates with auto slug', async () => {
    const sid = await seedUserAndSession('admin');
    const res = await SELF.fetch('http://localhost/api/presets', {
      method: 'POST',
      headers: { Cookie: await signCookie(sid), 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'Beispiel Link', kind: 'url', value: 'https://x' })
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe('beispiel-link');
  });

  it('400 on invalid', async () => {
    const sid = await seedUserAndSession('admin');
    const res = await SELF.fetch('http://localhost/api/presets', {
      method: 'POST',
      headers: { Cookie: await signCookie(sid), 'content-type': 'application/json' },
      body: JSON.stringify({ label: '', kind: 'url', value: 'x' })
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: POST-Handler in `+server.ts` ergänzen**

```ts
import { validatePresetInput } from '$lib/server/presets/validator';
import { slugify, uniqueSlug } from '$lib/server/presets/slug';
import { insertPreset, getPreset } from '$lib/server/presets/repo';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  if (locals.user.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const body = await request.json().catch(() => null);
  const result = validatePresetInput(body);
  if (!result.ok) return json({ error: result.error }, { status: 400 });

  const db = requireDb(platform);
  const id = result.value.id ?? (await uniqueSlug(db, slugify(result.value.label)));
  await insertPreset(
    db,
    { id, label: result.value.label, icon: result.value.icon, kind: result.value.kind, value: result.value.value },
    locals.user.id
  );
  const created = await getPreset(db, id);
  return json(created, { status: 201 });
};
```

- [ ] **Step 3: Tests grün, Commit**

```bash
pnpm test:integration
git add src/routes/api/presets/+server.ts tests/server/api/presets-post.test.ts
git commit -m "feat(api): POST /api/presets with validation, slug, admin-only"
```

---

## Task 23: `PUT` + `DELETE /api/presets/[id]` + Test

**Files:**
- Create: `src/routes/api/presets/[id]/+server.ts`
- Create: `tests/server/api/presets-update-delete.test.ts`

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { seedUserAndSession, signCookie } from './_helpers';

async function seedPreset(id = 'p1') {
  await env.DB.prepare(
    `INSERT INTO presets (id,label,kind,value,sort_order,created_at,updated_at,created_by,updated_by)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(id, id, 'text', '"hi"', 0, 0, 0, 'sys', 'sys').run();
}

describe('PUT/DELETE /api/presets/:id', () => {
  it('PUT requires admin', async () => {
    await seedPreset();
    const sid = await seedUserAndSession('user');
    const res = await SELF.fetch('http://localhost/api/presets/p1', {
      method: 'PUT',
      headers: { Cookie: await signCookie(sid), 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'Neu', kind: 'text', value: 'x' })
    });
    expect(res.status).toBe(403);
  });

  it('PUT updates', async () => {
    await seedPreset('p2');
    const sid = await seedUserAndSession('admin');
    const res = await SELF.fetch('http://localhost/api/presets/p2', {
      method: 'PUT',
      headers: { Cookie: await signCookie(sid), 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'Neu', kind: 'text', value: 'x' })
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { label: string };
    expect(body.label).toBe('Neu');
  });

  it('PUT 404 unknown', async () => {
    const sid = await seedUserAndSession('admin');
    const res = await SELF.fetch('http://localhost/api/presets/missing', {
      method: 'PUT',
      headers: { Cookie: await signCookie(sid), 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'X', kind: 'text', value: 'x' })
    });
    expect(res.status).toBe(404);
  });

  it('DELETE removes', async () => {
    await seedPreset('p3');
    const sid = await seedUserAndSession('admin');
    const res = await SELF.fetch('http://localhost/api/presets/p3', {
      method: 'DELETE',
      headers: { Cookie: await signCookie(sid) }
    });
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Endpoint**

```ts
import { json, type RequestHandler } from '@sveltejs/kit';
import { requireDb } from '$lib/server/db';
import { validatePresetInput } from '$lib/server/presets/validator';
import { deletePreset, getPreset, updatePreset } from '$lib/server/presets/repo';

export const prerender = false;

export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  if (locals.user.role !== 'admin') return new Response('Forbidden', { status: 403 });
  const body = await request.json().catch(() => null);
  const result = validatePresetInput(body);
  if (!result.ok) return json({ error: result.error }, { status: 400 });
  const db = requireDb(platform);
  const ok = await updatePreset(
    db,
    params.id!,
    { label: result.value.label, icon: result.value.icon, kind: result.value.kind, value: result.value.value },
    locals.user.id
  );
  if (!ok) return new Response('Not Found', { status: 404 });
  return json(await getPreset(db, params.id!));
};

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  if (locals.user.role !== 'admin') return new Response('Forbidden', { status: 403 });
  const ok = await deletePreset(requireDb(platform), params.id!);
  if (!ok) return new Response('Not Found', { status: 404 });
  return new Response(null, { status: 204 });
};
```

- [ ] **Step 3: Tests grün, Commit**

```bash
pnpm test:integration
git add src/routes/api/presets/[id]/+server.ts tests/server/api/presets-update-delete.test.ts
git commit -m "feat(api): PUT and DELETE /api/presets/:id"
```

---

## Task 24: `POST /api/presets/reorder` + Test

**Files:**
- Create: `src/routes/api/presets/reorder/+server.ts`
- Create: `tests/server/api/presets-reorder.test.ts`

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { seedUserAndSession, signCookie } from './_helpers';

describe('POST /api/presets/reorder', () => {
  it('admin reorders', async () => {
    for (const id of ['a', 'b', 'c']) {
      await env.DB.prepare(
        `INSERT INTO presets (id,label,kind,value,sort_order,created_at,updated_at,created_by,updated_by)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).bind(id, id, 'text', '"x"', 0, 0, 0, 's', 's').run();
    }
    const sid = await seedUserAndSession('admin');
    const res = await SELF.fetch('http://localhost/api/presets/reorder', {
      method: 'POST',
      headers: { Cookie: await signCookie(sid), 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['c', 'a', 'b'] })
    });
    expect(res.status).toBe(204);
    const list = await env.DB.prepare(
      `SELECT id FROM presets ORDER BY sort_order, label`
    ).all<{ id: string }>();
    expect(list.results.map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('rejects malformed body', async () => {
    const sid = await seedUserAndSession('admin');
    const res = await SELF.fetch('http://localhost/api/presets/reorder', {
      method: 'POST',
      headers: { Cookie: await signCookie(sid), 'content-type': 'application/json' },
      body: '{}'
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Endpoint**

```ts
import { type RequestHandler } from '@sveltejs/kit';
import { requireDb } from '$lib/server/db';
import { reorderPresets } from '$lib/server/presets/repo';

export const prerender = false;

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  if (locals.user.role !== 'admin') return new Response('Forbidden', { status: 403 });
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  if (!body || !Array.isArray(body.ids) || body.ids.some((x) => typeof x !== 'string')) {
    return new Response('Bad Request', { status: 400 });
  }
  await reorderPresets(requireDb(platform), body.ids as string[]);
  return new Response(null, { status: 204 });
};
```

- [ ] **Step 3: Tests grün, Commit**

```bash
pnpm test:integration
git add src/routes/api/presets/reorder/+server.ts tests/server/api/presets-reorder.test.ts
git commit -m "feat(api): POST /api/presets/reorder updates sort order"
```

---

## Task 25: Auth-Store + Header-UI

**Files:**
- Create: `src/lib/stores/auth.ts`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Auth-Store**

`src/lib/stores/auth.ts`:
```ts
import { writable, type Readable } from 'svelte/store';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';
}

const store = writable<AuthUser | null>(null);
export const auth: Readable<AuthUser | null> = { subscribe: store.subscribe };

export function setAuthUser(user: AuthUser | null): void {
  store.set(user);
}

export async function refreshAuth(fetchFn: typeof fetch = fetch): Promise<void> {
  try {
    const res = await fetchFn('/api/me', { credentials: 'same-origin' });
    if (!res.ok) return setAuthUser(null);
    const data = (await res.json()) as { user: AuthUser | null };
    setAuthUser(data.user);
  } catch {
    setAuthUser(null);
  }
}

export async function logout(fetchFn: typeof fetch = fetch): Promise<void> {
  await fetchFn('/auth/logout', { method: 'POST', credentials: 'same-origin' });
  setAuthUser(null);
}
```

- [ ] **Step 2: `+layout.svelte` umbauen**

Lese aktuellen Inhalt; ersetze Skript-Teil und ergänze Topbar (Originalstruktur des Layouts bleibt erhalten):

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { auth, refreshAuth, setAuthUser, logout } from '$lib/stores/auth';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: any } = $props();
  setAuthUser(data.user);
  onMount(() => { refreshAuth(); });

  function loginHref(): string {
    const ret = encodeURIComponent($page.url.pathname + $page.url.search);
    return `/auth/login?return=${ret}`;
  }
</script>

<nav class="topbar">
  <a href="/" class="brand">DRK QR</a>
  <div class="spacer"></div>
  {#if $auth}
    {#if $auth.role === 'admin'}
      <a class="link" href="/admin">⚙️ Verwalten</a>
    {/if}
    <span class="user" title={$auth.email}>{$auth.displayName ?? $auth.email}</span>
    <button type="button" class="link" onclick={() => logout()}>Abmelden</button>
  {:else}
    <a class="link" href={loginHref()}>🔑 Anmelden</a>
  {/if}
</nav>

{@render children()}

<style>
  .topbar { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 1rem; border-bottom: 1px solid #eee; }
  .brand { font-weight: 600; text-decoration: none; }
  .spacer { flex: 1; }
  .user { color: #555; font-size: 0.9rem; }
  .link { background: none; border: none; padding: 0; color: #0366d6; cursor: pointer; }
</style>
```

- [ ] **Step 3: Typecheck**

```bash
pnpm check
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/stores/auth.ts src/routes/+layout.svelte
git commit -m "feat(client): auth store + topbar with login/logout/admin link"
```

---

## Task 26: `/` Hauptseite — Presets aus API laden

**Files:**
- Modify: `src/routes/+page.svelte`, `src/lib/presets.ts`

- [ ] **Step 1: `src/lib/presets.ts` reduzieren**

```ts
import type { Preset, QrKind } from './types';

const VALID_KINDS: ReadonlyArray<QrKind> = ['url', 'wifi', 'tel', 'vcard', 'text'];

export interface PresetsFile {
  version: number;
  presets: Preset[];
}

export function validatePresetsFile(input: unknown): asserts input is PresetsFile {
  if (typeof input !== 'object' || input === null) throw new Error('presets: not an object');
  const obj = input as Record<string, unknown>;
  if (obj.version !== 1) throw new Error('presets: unsupported version');
  if (!Array.isArray(obj.presets)) throw new Error('presets: presets is not an array');
}
```

`allPresets`/`getPreset` und der Import von `presets.json` entfallen.

- [ ] **Step 2: `+page.svelte` Skript-Teil**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import PresetGrid from '$lib/components/PresetGrid.svelte';
  import UrlInput from '$lib/components/UrlInput.svelte';
  import HistoryList from '$lib/components/HistoryList.svelte';
  import OfflineIndicator from '$lib/components/OfflineIndicator.svelte';
  import { payloadToQrString } from '$lib/payload';
  import { QR_MAX_LENGTH } from '$lib/qr';
  import { loadHistory, addEntry } from '$lib/history';
  import { randomId } from '$lib/uuid';
  import { auth } from '$lib/stores/auth';
  import type { Preset, HistoryEntry, QrPayload } from '$lib/types';

  let presets = $state<Preset[]>([]);
  let presetsLoaded = $state(false);
  let url = $state('');
  let history = $state<HistoryEntry[]>([]);

  onMount(async () => {
    history = loadHistory();
    try {
      const res = await fetch('/api/presets', { credentials: 'same-origin' });
      if (res.ok) {
        const body = (await res.json()) as { presets: Preset[] };
        presets = body.presets;
      }
    } catch { /* ignore */ }
    finally { presetsLoaded = true; }
  });

  function recordAndNavigate(label: string, payload: QrPayload) {
    const entry: HistoryEntry = { id: randomId(), label, payload, createdAt: Date.now() };
    addEntry(entry);
    history = loadHistory();
    const params = new URLSearchParams({
      data: payloadToQrString(payload),
      label,
      kind: payload.kind
    });
    goto(`/qr?${params.toString()}`);
  }

  function onPreset(p: Preset) { recordAndNavigate(p.label, p); }
  function onUrlSubmit() { if (url) recordAndNavigate(url, { kind: 'url', value: url }); }
  function onHistorySelect(e: HistoryEntry) {
    const params = new URLSearchParams({
      data: payloadToQrString(e.payload),
      label: e.label,
      kind: e.payload.kind
    });
    goto(`/qr?${params.toString()}`);
  }
</script>
```

- [ ] **Step 3: Template — Preset-Section conditional**

```svelte
{#if presetsLoaded && presets.length > 0}
  <section aria-label="Presets">
    <PresetGrid {presets} onSelect={onPreset} />
  </section>
{:else if !presetsLoaded}
  <section aria-label="Presets"><p>Lade Presets…</p></section>
{:else if !$auth}
  <section aria-label="Hinweis" class="hint">
    <p>Tipp: <a href="/auth/login?return=/">Melde dich an</a>, um Schnellzugriffe zu sehen.</p>
  </section>
{/if}
```

- [ ] **Step 4: Typecheck, Commit**

```bash
pnpm check
git add src/lib/presets.ts src/routes/+page.svelte
git commit -m "feat(client): fetch presets from /api/presets instead of build-time import"
```

---

## Task 27: Admin-Route + Skeleton

**Files:**
- Create: `src/routes/admin/+page.server.ts`, `+page.ts`, `+page.svelte`

- [ ] **Step 1: Guard**

`src/routes/admin/+page.server.ts`:
```ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ locals, url }) => {
  if (!locals.user) {
    const ret = encodeURIComponent(url.pathname + url.search);
    throw redirect(302, `/auth/login?return=${ret}`);
  }
  if (locals.user.role !== 'admin') {
    throw redirect(302, '/?noaccess=1');
  }
  return { user: locals.user };
};
```

`src/routes/admin/+page.ts`:
```ts
export const prerender = false;
```

- [ ] **Step 2: Seite**

`src/routes/admin/+page.svelte`:
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Preset } from '$lib/types';
  import PresetForm from './PresetForm.svelte';

  let presets = $state<Preset[]>([]);
  let editing = $state<Preset | null>(null);
  let creating = $state(false);
  let error = $state<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/presets');
    if (!res.ok) { error = `Laden fehlgeschlagen (${res.status})`; return; }
    presets = ((await res.json()) as { presets: Preset[] }).presets;
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= presets.length) return;
    const ids = presets.map((p) => p.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const res = await fetch('/api/presets/reorder', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if (res.ok) await refresh();
  }

  async function remove(p: Preset) {
    if (!confirm(`"${p.label}" löschen?`)) return;
    const res = await fetch(`/api/presets/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
    if (res.status === 204 || res.status === 404) await refresh();
    else error = `Löschen fehlgeschlagen (${res.status})`;
  }

  async function saved() {
    editing = null;
    creating = false;
    await refresh();
  }

  onMount(refresh);
</script>

<h1>Presets verwalten</h1>
{#if error}<p class="error">{error}</p>{/if}
<button type="button" onclick={() => (creating = true)}>+ Neues Preset</button>

{#if creating}
  <PresetForm onSave={saved} onCancel={() => (creating = false)} />
{/if}

<ul>
  {#each presets as p, i (p.id)}
    <li>
      <span>{p.icon ?? ''} {p.label} <code>({p.kind})</code></span>
      <button type="button" onclick={() => move(i, -1)} aria-label="nach oben">↑</button>
      <button type="button" onclick={() => move(i, 1)} aria-label="nach unten">↓</button>
      <button type="button" onclick={() => (editing = p)}>Bearbeiten</button>
      <button type="button" onclick={() => remove(p)}>Löschen</button>
    </li>
  {/each}
</ul>

{#if editing}
  <PresetForm preset={editing} onSave={saved} onCancel={() => (editing = null)} />
{/if}
```

- [ ] **Step 3: Commit (Form-Komponente folgt Task 28)**

```bash
git add src/routes/admin/+page.server.ts src/routes/admin/+page.ts src/routes/admin/+page.svelte
git commit -m "feat(admin): admin page skeleton with list + reorder + delete"
```

---

## Task 28: Admin-Preset-Form

**Files:**
- Create: `src/routes/admin/PresetForm.svelte`

- [ ] **Step 1: Komponente**

```svelte
<script lang="ts">
  import type { Preset, QrKind } from '$lib/types';

  interface Props {
    preset?: Preset;
    onSave: (p: Preset) => void;
    onCancel: () => void;
  }
  let { preset, onSave, onCancel }: Props = $props();

  let label = $state(preset?.label ?? '');
  let icon = $state(preset?.icon ?? '');
  let kind = $state<QrKind>(preset?.kind ?? 'url');
  let urlValue = $state(preset?.kind === 'url' ? (preset.value as string) : '');
  let telValue = $state(preset?.kind === 'tel' ? (preset.value as string) : '');
  let textValue = $state(preset?.kind === 'text' ? (preset.value as string) : '');
  let ssid = $state(preset?.kind === 'wifi' ? preset.value.ssid : '');
  let password = $state(preset?.kind === 'wifi' ? preset.value.password : '');
  let encryption = $state<'WPA' | 'WEP' | 'nopass'>(
    preset?.kind === 'wifi' ? preset.value.encryption : 'WPA'
  );
  let hidden = $state(preset?.kind === 'wifi' ? !!preset.value.hidden : false);
  let name = $state(preset?.kind === 'vcard' ? preset.value.name : '');
  let tel = $state(preset?.kind === 'vcard' ? preset.value.tel ?? '' : '');
  let email = $state(preset?.kind === 'vcard' ? preset.value.email ?? '' : '');
  let org = $state(preset?.kind === 'vcard' ? preset.value.org ?? '' : '');

  let busy = $state(false);
  let error = $state<string | null>(null);

  function buildValue(): unknown {
    switch (kind) {
      case 'url': return urlValue;
      case 'tel': return telValue;
      case 'text': return textValue;
      case 'wifi': return { ssid, password, encryption, hidden };
      case 'vcard':
        return {
          name,
          tel: tel || undefined,
          email: email || undefined,
          org: org || undefined
        };
    }
  }

  async function submit(e: Event) {
    e.preventDefault();
    busy = true;
    error = null;
    const payload = { label, icon: icon || undefined, kind, value: buildValue() };
    const target = preset ? `/api/presets/${encodeURIComponent(preset.id)}` : '/api/presets';
    const res = await fetch(target, {
      method: preset ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    busy = false;
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      error = body.error ?? `Fehler ${res.status}`;
      return;
    }
    onSave((await res.json()) as Preset);
  }
</script>

<form onsubmit={submit} class="preset-form">
  <label>Bezeichnung <input bind:value={label} maxlength="80" required /></label>
  <label>Icon (optional) <input bind:value={icon} maxlength="4" /></label>
  <label>Art
    <select bind:value={kind} disabled={!!preset}>
      <option value="url">URL</option>
      <option value="wifi">WLAN</option>
      <option value="tel">Telefon</option>
      <option value="vcard">Kontakt</option>
      <option value="text">Text</option>
    </select>
  </label>

  {#if kind === 'url'}
    <label>URL <input type="url" bind:value={urlValue} required /></label>
  {:else if kind === 'tel'}
    <label>Telefonnummer <input type="tel" bind:value={telValue} required /></label>
  {:else if kind === 'text'}
    <label>Text <textarea bind:value={textValue} required></textarea></label>
  {:else if kind === 'wifi'}
    <label>SSID <input bind:value={ssid} required /></label>
    <label>Passwort <input bind:value={password} /></label>
    <label>Verschlüsselung
      <select bind:value={encryption}>
        <option>WPA</option><option>WEP</option><option value="nopass">offen</option>
      </select>
    </label>
    <label><input type="checkbox" bind:checked={hidden} /> Versteckt</label>
  {:else if kind === 'vcard'}
    <label>Name <input bind:value={name} required /></label>
    <label>Telefon <input type="tel" bind:value={tel} /></label>
    <label>E-Mail <input type="email" bind:value={email} /></label>
    <label>Organisation <input bind:value={org} /></label>
  {/if}

  {#if error}<p class="error">{error}</p>{/if}

  <div class="actions">
    <button type="submit" disabled={busy}>{preset ? 'Speichern' : 'Anlegen'}</button>
    <button type="button" onclick={onCancel}>Abbrechen</button>
  </div>
</form>
```

- [ ] **Step 2: Typecheck + Commit**

```bash
pnpm check
git add src/routes/admin/PresetForm.svelte
git commit -m "feat(admin): preset form with per-kind fields"
```

---

## Task 29: Service-Worker Runtime-Caching

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Aktuelles `vite.config.ts` lesen** und im `SvelteKitPWA(...)`-Call den `workbox.runtimeCaching`-Block ergänzen — andere Optionen unverändert lassen:

```ts
runtimeCaching: [
  {
    urlPattern: ({ url }) => url.pathname === '/api/presets',
    handler: 'NetworkFirst',
    options: {
      cacheName: 'api-presets',
      networkTimeoutSeconds: 2,
      expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 },
      cacheableResponse: { statuses: [200] }
    }
  },
  {
    urlPattern: ({ url }) => url.pathname === '/api/me',
    handler: 'NetworkOnly'
  },
  {
    urlPattern: ({ url }) => url.pathname.startsWith('/auth/'),
    handler: 'NetworkOnly'
  },
  {
    urlPattern: ({ url }) => url.pathname.startsWith('/api/presets/'),
    handler: 'NetworkOnly'
  }
]
```

- [ ] **Step 2: Build smoke**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat(pwa): runtime caching for /api/presets (NetworkFirst)"
```

---

## Task 30: Build-Zeit-Validierung aufräumen

**Files:**
- Delete: `scripts/validate-presets.ts`, `src/data/presets.json`
- Modify: `package.json`

- [ ] **Step 1: Dateien entfernen**

```bash
git rm scripts/validate-presets.ts src/data/presets.json
```

- [ ] **Step 2: `package.json` Scripts**

Entferne `"validate:presets"` und `"prebuild"` aus `scripts`.

- [ ] **Step 3: Sicherstellen, dass keine Referenzen mehr existieren**

Run: `grep -rn "src/data/presets" src/` → leer.
Run: `pnpm check && pnpm build` → grün.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: remove build-time presets validation (moved to server)"
```

---

## Task 31: README + Setup-Doku

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Setup-Abschnitt ergänzen**

````markdown
## Lokales Setup (mit Backend)

```bash
pnpm install
pnpm wrangler d1 create drk-qr-presets   # einmalig, database_id in wrangler.toml übernehmen
pnpm wrangler d1 migrations apply drk-qr-presets --local
cp .dev.vars.example .dev.vars            # Pocket-ID-Credentials eintragen
pnpm dev
```

## Tests

```bash
pnpm test               # Unit-Tests
pnpm test:integration   # Vitest Workers Pool (Miniflare + D1)
pnpm test:e2e           # Playwright
```

## Deployment (Cloudflare Pages)

1. Build-Command: `pnpm install --frozen-lockfile && pnpm build`
2. Output: `.svelte-kit/cloudflare`
3. Migrationen: `pnpm wrangler d1 migrations apply drk-qr-presets --remote`
4. Secrets: `pnpm wrangler pages secret put POCKET_ID_CLIENT_SECRET` und `... SESSION_SECRET`
5. Pocket ID: Redirect-URI `https://<host>/auth/callback`, Scopes `openid profile email groups`, Gruppen `drk-qr-admin`, `drk-qr-user`.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: backend setup, tests, deployment notes"
```

---

## Task 32: E2E-Flow mit Pocket-ID-Mock

**Files:**
- Create: `tests/e2e/_oidc-mock.ts`, `tests/e2e/auth-admin-flow.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: OIDC-Mock**

```ts
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
        stop: () => new Promise((r) => server.close(() => r()))
      })
    )
  );
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}
```

- [ ] **Step 2: E2E-Test**

```ts
import { test, expect } from '@playwright/test';
import { startOidcMock } from './_oidc-mock';

let mock: Awaited<ReturnType<typeof startOidcMock>>;
test.beforeAll(async () => { mock = await startOidcMock(); });
test.afterAll(async () => { await mock.stop(); });

test('anonymous can generate QR; admin can manage presets', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('🔑 Anmelden')).toBeVisible();
  await page.fill('input[type="url"]', 'https://example.org');
  await page.getByRole('button', { name: /qr erzeugen/i }).click();
  await expect(page.locator('canvas, svg')).toBeVisible();

  await page.goto('/auth/login?return=/admin');
  await expect(page).toHaveURL(/\/admin/);
  await page.getByRole('button', { name: '+ Neues Preset' }).click();
  await page.getByLabel('Bezeichnung').fill('E2E Link');
  await page.getByLabel('URL').fill('https://e2e.test');
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.getByText('E2E Link')).toBeVisible();
});
```

- [ ] **Step 3: `playwright.config.ts` mit Wrangler-Webserver + Env**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'pnpm wrangler pages dev .svelte-kit/cloudflare --port 5173',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    env: {
      POCKET_ID_ISSUER: 'http://localhost:4787',
      POCKET_ID_CLIENT_ID: 'test',
      POCKET_ID_CLIENT_SECRET: 'test',
      POCKET_ID_REDIRECT_URI: 'http://localhost:5173/auth/callback',
      SESSION_SECRET: 'e2e-secret-bytes-hex-xxxxxxxxxxxxx',
      APP_ORIGIN: 'http://localhost:5173'
    }
  },
  use: { baseURL: 'http://localhost:5173' }
});
```

- [ ] **Step 4: Lauf**

```bash
pnpm build
pnpm test:e2e
```

(Falls Wrangler-Pages-Dev die `env` aus Playwright nicht aufnimmt, schreibe vor dem Test eine `.dev.vars` mit denselben Werten und stelle danach den Originalzustand wieder her — als CI-Skript.)

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/_oidc-mock.ts tests/e2e/auth-admin-flow.spec.ts playwright.config.ts
git commit -m "test(e2e): full anonymous + admin flow with OIDC mock"
```

---

## Task 33: Final-Smoke + Lint

- [ ] **Step 1: Lint + Format**

```bash
pnpm lint
pnpm format
```

- [ ] **Step 2: Volle Test-Suite**

```bash
pnpm test:all
```

- [ ] **Step 3: Production-Build**

```bash
pnpm build
```

- [ ] **Step 4: Manuelle UI-Smoke (Browser)**

- `pnpm dev`
- Anonym `/` → „🔑 Anmelden", URL-Form funktioniert.
- `/admin` ohne Login → Redirect auf `/auth/login`.
- Nach Login: `/admin` zeigt Liste, CRUD und Sortieren funktionieren.
- `/` zeigt Preset-Grid.
- DevTools → Application → Service Worker: Cache `api-presets` befüllt.

- [ ] **Step 5: Commit etwaiger Lint-Fixes**

```bash
git status
git add .
git diff --cached --stat
git commit -m "chore: final lint/format pass" || echo "nothing to commit"
```

---

## Annahmen und Hinweise

1. **Oslo entfällt** — `oslo` wird in der Spec genannt, ist inzwischen aber deprecated. Web Crypto + arctic genügen funktional.
2. **`prerender = 'auto'`** lässt SvelteKit pro Route entscheiden; dynamische Endpoints opten via `export const prerender = false;` aus. Statische Routen (`/wifi`, `/tel`, `/contact`, `/qr`) bleiben unverändert prerendered.
3. **Groups-Claim**: Pocket ID liefert `groups` typischerweise im ID-Token; falls in deinem Setup nur die UserInfo das hat, deckt `/auth/callback` beides ab (Merge in dieser Reihenfolge).
4. **SameSite=Lax** für Session-Cookies: OIDC-Callback ist ein cross-site GET; Strict würde den Cookie beim Callback dropen. Origin-Check im Logout-Endpoint deckt CSRF auf Mutations ab.
5. **Tests in `tests/server/api/**`** laufen ausschließlich via `vitest.workers.config.ts`; der reguläre `vitest.config.ts` schließt sie aus, damit `pnpm test` schnell bleibt.
6. **Fake-D1 mit better-sqlite3** ist eine Unit-Test-Bequemlichkeit für Repos/Helpers (kein D1-Replacement). Integrationstests laufen gegen Miniflare-D1 (Task 19+).
7. **CSP/Headers** sind nicht im Plan; Cloudflare Pages erlaubt eine `_headers`-Datei für späteren Ausbau.
8. Falls `@cloudflare/vitest-pool-workers` Importe (`cloudflare:test`, `applyD1Migrations`) anders aussehen als hier skizziert, an aktuelle Pool-Worker-Doku adaptieren; die Test-Logik bleibt äquivalent.

---

## Execution Handoff

**Plan vollständig und gespeichert unter `docs/superpowers/plans/2026-05-13-backend-auth.md`. Zwei Ausführungsoptionen:**

**1. Subagent-Driven (empfohlen)** — Ich dispatche pro Task einen frischen Subagent, reviewe zwischen den Tasks, schnelle Iteration.

**2. Inline Execution** — Tasks in dieser Session ausführen via executing-plans, Batch-Lauf mit Checkpoints zur Review.

**Welche Variante?**
