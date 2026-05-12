# QR-Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine offline-fähige PWA bauen, die im Katastrophenschutz-Einsatz in maximal drei Taps einen scannbaren Vollbild-QR-Code für URLs, WLAN, Telefon und vCards erzeugt.

**Architecture:** SvelteKit mit `adapter-static` als reine Client-PWA (kein SSR zur Laufzeit), `@vite-pwa/sveltekit` für Service-Worker-Precaching, reine TypeScript-Funktionen für Payload-Encoding und QR-Generierung (DOM-frei, vollständig testbar), Routen-basierte UI ohne Modals damit Browser-Zurück funktioniert. LocalStorage mit In-Memory-Fallback für den Verlauf. Build-Zeit-Validierung der Presets verhindert ungültige Daten in Produktion.

**Tech Stack:** SvelteKit + TypeScript, pnpm, Vite, `qrcode` (npm), `@vite-pwa/sveltekit` (Workbox), Vitest + `@testing-library/svelte`, Playwright, `jsqr` (Round-Trip-Tests), Cloudflare Pages, GitHub Actions.

---

## File Structure

**Source (`src/`):**
- `app.html` — HTML-Shell mit Viewport, Theme-Color, kein DRK-Branding
- `routes/+layout.svelte` — PWA-Shell, Update-Prompt, Offline-Indikator
- `routes/+page.svelte` — Hauptansicht (Presets, URL-Input, Verlauf, Sub-Routen-Buttons)
- `routes/qr/+page.svelte` — Vollbild-QR-Anzeige
- `routes/wifi/+page.svelte` — WLAN-Eingabeformular
- `routes/tel/+page.svelte` — Telefon-Eingabeformular
- `routes/contact/+page.svelte` — Kontakt (vCard) Eingabeformular
- `lib/types.ts` — `QrPayload`, `Preset`, `HistoryEntry`
- `lib/payload.ts` — Reine Funktion `payloadToQrString(p: QrPayload): string` inkl. WIFI-Escape & vCard-Format
- `lib/qr.ts` — `payloadToSvg(text: string): string` mit ECC-H, Quiet Zone ≥ 4
- `lib/history.ts` — LocalStorage-Wrapper mit Memory-Fallback und Schema-Validierung
- `lib/presets.ts` — Presets-Validator + Lookup
- `lib/uuid.ts` — `randomId()` mit `crypto.randomUUID`-Fallback
- `lib/components/PresetGrid.svelte`
- `lib/components/UrlInput.svelte`
- `lib/components/QrDisplay.svelte`
- `lib/components/HistoryList.svelte`
- `lib/components/UpdatePrompt.svelte`
- `lib/components/OfflineIndicator.svelte`
- `data/presets.json` — Build-Zeit-importiert

**Static (`static/`):**
- `manifest.webmanifest`
- `icons/192.png`, `icons/512.png`, `icons/maskable.png`

**Tests (`tests/`):**
- `unit/payload.test.ts`
- `unit/qr.test.ts`
- `unit/history.test.ts`
- `unit/presets.test.ts`
- `unit/uuid.test.ts`
- `unit/components/UrlInput.test.ts`
- `unit/components/PresetGrid.test.ts`
- `unit/components/QrDisplay.test.ts`
- `e2e/preset-flow.spec.ts`
- `e2e/url-flow.spec.ts`
- `e2e/wifi-flow.spec.ts`
- `e2e/offline.spec.ts`
- `e2e/history.spec.ts`
- `e2e/pwa-manifest.spec.ts`
- `e2e/helpers/decode-qr.ts` — Round-Trip mit `jsqr`

**Konfiguration / Doku:**
- `package.json`, `pnpm-lock.yaml`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`
- `.eslintrc.cjs`, `.prettierrc`, `playwright.config.ts`, `vitest.config.ts`
- `scripts/validate-presets.ts` — Build-Hook
- `.github/workflows/ci.yml`
- `docs/manual-test.md`

---

## Phase 1: Projekt-Foundation

### Task 1: SvelteKit-Projekt initialisieren

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml` (optional), `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `.gitignore`, `src/app.html`, `src/routes/+page.svelte`, `src/routes/+layout.svelte`

- [ ] **Step 1: Verzeichnis vorbereiten und SvelteKit-Skeleton anlegen**

```bash
cd /Users/rubeen/dev/personal/drk/qr-generator
pnpm dlx sv create . --template minimal --types ts --no-add-ons
```

Bei interaktiver Rückfrage „Directory not empty" → mit Bestätigung fortfahren (docs/ und .git bleiben unangetastet).
Erwartet: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `src/app.html`, `src/routes/+page.svelte` werden erzeugt.

- [ ] **Step 2: pnpm als verbindlich pinnen**

In `package.json` das Feld `packageManager` ergänzen (Version aus `pnpm --version` einsetzen, z. B. `9.12.0`):

```json
{
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 3: Dependencies installieren**

Run:
```bash
pnpm install
```
Expected: `pnpm-lock.yaml` wird erzeugt, kein Fehler.

- [ ] **Step 4: Dev-Server-Smoke-Test**

Run:
```bash
pnpm dev --port 5173
```
Expected: Vite startet, „Local: http://localhost:5173" sichtbar. Mit `Ctrl-C` beenden.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: bootstrap SvelteKit project with pnpm"
```

---

### Task 2: Static-Adapter konfigurieren

**Files:**
- Modify: `svelte.config.js`
- Modify: `package.json`

- [ ] **Step 1: `adapter-static` installieren**

```bash
pnpm add -D @sveltejs/adapter-static
```

- [ ] **Step 2: `svelte.config.js` anpassen**

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: true
    })
  }
};

export default config;
```

- [ ] **Step 3: Prerender und SSR im Root-Layout deaktivieren**

Datei `src/routes/+layout.ts` neu anlegen:

```ts
export const prerender = true;
export const ssr = false;
```

- [ ] **Step 4: Build-Smoke-Test**

Run:
```bash
pnpm build
```
Expected: `build/`-Verzeichnis mit `index.html` und Assets. Keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add svelte.config.js src/routes/+layout.ts package.json pnpm-lock.yaml
git commit -m "build: configure static adapter for client-only PWA"
```

---

### Task 3: Lint, Format, Typecheck

**Files:**
- Create: `.eslintrc.cjs`, `.prettierrc`, `.prettierignore`, `.eslintignore`
- Modify: `package.json` (Scripts)

- [ ] **Step 1: Tooling installieren**

```bash
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-svelte prettier prettier-plugin-svelte svelte-check
```

- [ ] **Step 2: `.eslintrc.cjs` schreiben**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:svelte/recommended'],
  plugins: ['@typescript-eslint'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022,
    extraFileExtensions: ['.svelte']
  },
  env: { browser: true, es2022: true, node: true },
  overrides: [
    { files: ['*.svelte'], parser: 'svelte-eslint-parser', parserOptions: { parser: '@typescript-eslint/parser' } }
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
  }
};
```

- [ ] **Step 3: `.prettierrc` schreiben**

```json
{
  "useTabs": false,
  "singleQuote": true,
  "trailingComma": "none",
  "printWidth": 100,
  "plugins": ["prettier-plugin-svelte"],
  "overrides": [{ "files": "*.svelte", "options": { "parser": "svelte" } }]
}
```

- [ ] **Step 4: `.prettierignore` und `.eslintignore` schreiben**

```
build
.svelte-kit
node_modules
pnpm-lock.yaml
```

- [ ] **Step 5: Scripts in `package.json` ergänzen**

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . && prettier --check .",
    "format": "prettier --write .",
    "typecheck": "svelte-check --tsconfig ./tsconfig.json && tsc --noEmit"
  }
}
```

- [ ] **Step 6: Tooling-Smoke-Test**

Run:
```bash
pnpm lint && pnpm typecheck
```
Expected: Beide Befehle ohne Fehler.

- [ ] **Step 7: Commit**

```bash
git add .eslintrc.cjs .prettierrc .prettierignore .eslintignore package.json pnpm-lock.yaml
git commit -m "chore: add ESLint, Prettier, svelte-check tooling"
```

---

### Task 4: Vitest-Setup

**Files:**
- Create: `vitest.config.ts`, `tests/unit/.gitkeep`
- Modify: `package.json`

- [ ] **Step 1: Dependencies installieren**

```bash
pnpm add -D vitest jsdom @testing-library/svelte @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: `vitest.config.ts` schreiben**

```ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    globals: true,
    setupFiles: ['tests/unit/setup.ts']
  }
});
```

- [ ] **Step 3: `tests/unit/setup.ts` schreiben**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Test-Script ergänzen**

In `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 5: Vitest-Smoke-Test**

Run:
```bash
pnpm test
```
Expected: „No test files found, exiting with code 0" oder ähnlich — kein Crash. Bei Fehler wegen leerem Pattern: das ist ok, der erste echte Test in Task 6 deckt das ab.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/unit/setup.ts package.json pnpm-lock.yaml
git commit -m "test: configure Vitest with jsdom and testing-library"
```

---

## Phase 2: Types & reine Logik (TDD)

### Task 5: Typen definieren

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: `src/lib/types.ts` schreiben**

```ts
export type QrPayload =
  | { kind: 'url'; value: string }
  | {
      kind: 'wifi';
      value: {
        ssid: string;
        password: string;
        encryption: 'WPA' | 'WEP' | 'nopass';
        hidden?: boolean;
      };
    }
  | { kind: 'tel'; value: string }
  | {
      kind: 'vcard';
      value: { name: string; tel?: string; email?: string; org?: string };
    }
  | { kind: 'text'; value: string };

export type QrKind = QrPayload['kind'];

export interface Preset {
  id: string;
  label: string;
  icon?: string;
  kind: QrKind;
  value: Extract<QrPayload, { kind: QrKind }>['value'];
}

export interface HistoryEntry {
  id: string;
  label: string;
  payload: QrPayload;
  createdAt: number;
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
pnpm typecheck
```
Expected: Kein Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): define QrPayload, Preset, HistoryEntry"
```

---

### Task 6: Payload-Encoding (URL-Kind)

**Files:**
- Create: `tests/unit/payload.test.ts`
- Create: `src/lib/payload.ts`

- [ ] **Step 1: Failing Test schreiben**

```ts
// tests/unit/payload.test.ts
import { describe, it, expect } from 'vitest';
import { payloadToQrString } from '../../src/lib/payload';

describe('payloadToQrString — url', () => {
  it('returns the URL value as-is', () => {
    expect(payloadToQrString({ kind: 'url', value: 'https://example.org/x' })).toBe(
      'https://example.org/x'
    );
  });
});
```

- [ ] **Step 2: Test fehlschlagen lassen**

Run:
```bash
pnpm test -- payload
```
Expected: FAIL — `payloadToQrString` nicht gefunden.

- [ ] **Step 3: Minimale Implementierung**

```ts
// src/lib/payload.ts
import type { QrPayload } from './types';

export function payloadToQrString(p: QrPayload): string {
  if (p.kind === 'url') return p.value;
  throw new Error(`Unsupported kind: ${(p as { kind: string }).kind}`);
}
```

- [ ] **Step 4: Test grün**

Run:
```bash
pnpm test -- payload
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/payload.ts tests/unit/payload.test.ts
git commit -m "feat(payload): encode url payload"
```

---

### Task 7: Payload-Encoding (Telefon)

**Files:**
- Modify: `tests/unit/payload.test.ts`
- Modify: `src/lib/payload.ts`

- [ ] **Step 1: Failing Test ergänzen**

In `tests/unit/payload.test.ts` ergänzen:

```ts
describe('payloadToQrString — tel', () => {
  it('prefixes tel: scheme', () => {
    expect(payloadToQrString({ kind: 'tel', value: '+4915112345678' })).toBe(
      'tel:+4915112345678'
    );
  });
});
```

- [ ] **Step 2: Test fehlschlägt**

Run:
```bash
pnpm test -- payload
```
Expected: 1 failed (tel-Test).

- [ ] **Step 3: Implementierung erweitern**

In `src/lib/payload.ts` Branch ergänzen:

```ts
if (p.kind === 'tel') return `tel:${p.value}`;
```

- [ ] **Step 4: Test grün**

Run:
```bash
pnpm test -- payload
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/payload.ts tests/unit/payload.test.ts
git commit -m "feat(payload): encode tel payload"
```

---

### Task 8: Payload-Encoding (Text)

**Files:**
- Modify: `tests/unit/payload.test.ts`
- Modify: `src/lib/payload.ts`

- [ ] **Step 1: Failing Test ergänzen**

```ts
describe('payloadToQrString — text', () => {
  it('returns text value as-is', () => {
    expect(payloadToQrString({ kind: 'text', value: 'Hallo Welt' })).toBe('Hallo Welt');
  });
});
```

- [ ] **Step 2: Test fehlschlägt**

Run: `pnpm test -- payload` → FAIL.

- [ ] **Step 3: Implementierung**

```ts
if (p.kind === 'text') return p.value;
```

- [ ] **Step 4: Test grün**

Run: `pnpm test -- payload` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/payload.ts tests/unit/payload.test.ts
git commit -m "feat(payload): encode text payload"
```

---

### Task 9: Payload-Encoding (WLAN inkl. Escape)

**Files:**
- Modify: `tests/unit/payload.test.ts`
- Modify: `src/lib/payload.ts`

- [ ] **Step 1: Failing Tests ergänzen**

```ts
describe('payloadToQrString — wifi', () => {
  it('encodes WPA SSID and password', () => {
    expect(
      payloadToQrString({
        kind: 'wifi',
        value: { ssid: 'DRK-Gast', password: 'geheim', encryption: 'WPA' }
      })
    ).toBe('WIFI:T:WPA;S:DRK-Gast;P:geheim;H:false;;');
  });

  it('encodes nopass network', () => {
    expect(
      payloadToQrString({
        kind: 'wifi',
        value: { ssid: 'Open', password: '', encryption: 'nopass' }
      })
    ).toBe('WIFI:T:nopass;S:Open;P:;H:false;;');
  });

  it('encodes hidden flag', () => {
    expect(
      payloadToQrString({
        kind: 'wifi',
        value: { ssid: 'Stealth', password: 'x', encryption: 'WPA', hidden: true }
      })
    ).toBe('WIFI:T:WPA;S:Stealth;P:x;H:true;;');
  });

  it('escapes reserved characters in ssid and password', () => {
    expect(
      payloadToQrString({
        kind: 'wifi',
        value: { ssid: 'A;B,C:D"E\\F', password: 'p;a"b\\', encryption: 'WPA' }
      })
    ).toBe('WIFI:T:WPA;S:A\\;B\\,C\\:D\\"E\\\\F;P:p\\;a\\"b\\\\;H:false;;');
  });
});
```

- [ ] **Step 2: Tests fehlschlagen**

Run: `pnpm test -- payload` → FAIL.

- [ ] **Step 3: WIFI-Encoding implementieren**

In `src/lib/payload.ts` einfügen:

```ts
function escapeWifi(s: string): string {
  return s.replace(/([\\;,:"])/g, '\\$1');
}

function encodeWifi(v: Extract<QrPayload, { kind: 'wifi' }>['value']): string {
  const s = escapeWifi(v.ssid);
  const p = escapeWifi(v.password);
  const h = v.hidden ? 'true' : 'false';
  return `WIFI:T:${v.encryption};S:${s};P:${p};H:${h};;`;
}
```

In der `payloadToQrString`-Funktion vor dem `throw` ergänzen:

```ts
if (p.kind === 'wifi') return encodeWifi(p.value);
```

- [ ] **Step 4: Tests grün**

Run: `pnpm test -- payload` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/payload.ts tests/unit/payload.test.ts
git commit -m "feat(payload): encode wifi payload with spec-compliant escaping"
```

---

### Task 10: Payload-Encoding (vCard)

**Files:**
- Modify: `tests/unit/payload.test.ts`
- Modify: `src/lib/payload.ts`

- [ ] **Step 1: Failing Tests ergänzen**

```ts
describe('payloadToQrString — vcard', () => {
  it('encodes minimal vCard (name only)', () => {
    expect(payloadToQrString({ kind: 'vcard', value: { name: 'Max Mustermann' } })).toBe(
      'BEGIN:VCARD\nVERSION:3.0\nFN:Max Mustermann\nEND:VCARD'
    );
  });

  it('includes optional fields when present', () => {
    expect(
      payloadToQrString({
        kind: 'vcard',
        value: {
          name: 'Erika',
          tel: '+491701234567',
          email: 'erika@drk.de',
          org: 'DRK Kreisverband'
        }
      })
    ).toBe(
      'BEGIN:VCARD\nVERSION:3.0\nFN:Erika\nTEL:+491701234567\nEMAIL:erika@drk.de\nORG:DRK Kreisverband\nEND:VCARD'
    );
  });

  it('skips missing optional fields entirely', () => {
    expect(
      payloadToQrString({ kind: 'vcard', value: { name: 'A', email: 'a@b' } })
    ).toBe('BEGIN:VCARD\nVERSION:3.0\nFN:A\nEMAIL:a@b\nEND:VCARD');
  });
});
```

- [ ] **Step 2: Tests fehlschlagen**

Run: `pnpm test -- payload` → FAIL.

- [ ] **Step 3: vCard-Encoding implementieren**

In `src/lib/payload.ts`:

```ts
function encodeVcard(v: Extract<QrPayload, { kind: 'vcard' }>['value']): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${v.name}`];
  if (v.tel) lines.push(`TEL:${v.tel}`);
  if (v.email) lines.push(`EMAIL:${v.email}`);
  if (v.org) lines.push(`ORG:${v.org}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}
```

Branch in `payloadToQrString`:

```ts
if (p.kind === 'vcard') return encodeVcard(p.value);
```

- [ ] **Step 4: Tests grün**

Run: `pnpm test -- payload` → PASS — alle Payload-Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/payload.ts tests/unit/payload.test.ts
git commit -m "feat(payload): encode vCard payload"
```

---

### Task 11: UUID-Helper mit Fallback

**Files:**
- Create: `tests/unit/uuid.test.ts`
- Create: `src/lib/uuid.ts`

- [ ] **Step 1: Failing Test**

```ts
// tests/unit/uuid.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { randomId } from '../../src/lib/uuid';

describe('randomId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'aaaa-bbbb-cccc' });
    expect(randomId()).toBe('aaaa-bbbb-cccc');
  });

  it('falls back to Date.now() + Math.random() when randomUUID missing', () => {
    vi.stubGlobal('crypto', {});
    const id = randomId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(8);
  });
});
```

- [ ] **Step 2: Test fehlschlägt**

Run: `pnpm test -- uuid` → FAIL.

- [ ] **Step 3: Implementierung**

```ts
// src/lib/uuid.ts
export function randomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
```

- [ ] **Step 4: Test grün**

Run: `pnpm test -- uuid` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/uuid.ts tests/unit/uuid.test.ts
git commit -m "feat(uuid): randomId helper with randomUUID fallback"
```

---

### Task 12: QR-SVG-Generierung

**Files:**
- Create: `tests/unit/qr.test.ts`
- Create: `src/lib/qr.ts`

- [ ] **Step 1: `qrcode` installieren**

```bash
pnpm add qrcode
pnpm add -D @types/qrcode
```

- [ ] **Step 2: Failing Tests schreiben**

```ts
// tests/unit/qr.test.ts
import { describe, it, expect } from 'vitest';
import { payloadToSvg } from '../../src/lib/qr';

describe('payloadToSvg', () => {
  it('returns an SVG string', async () => {
    const svg = await payloadToSvg('hello');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('</svg>');
  });

  it('renders pure black on white', async () => {
    const svg = await payloadToSvg('hello');
    expect(svg).toContain('#000000');
    expect(svg).toContain('#ffffff');
  });

  it('rejects empty input', async () => {
    await expect(payloadToSvg('')).rejects.toThrow();
  });

  it('rejects input longer than QR_MAX_LENGTH', async () => {
    await expect(payloadToSvg('a'.repeat(1274))).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Tests fehlschlagen**

Run: `pnpm test -- qr` → FAIL.

- [ ] **Step 4: Implementierung**

```ts
// src/lib/qr.ts
import QRCode from 'qrcode';

export const QR_MAX_LENGTH = 1273;

export async function payloadToSvg(text: string): Promise<string> {
  if (!text) throw new Error('QR text must not be empty');
  if (text.length > QR_MAX_LENGTH)
    throw new Error(`QR text exceeds ${QR_MAX_LENGTH} characters`);
  return QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 4,
    color: { dark: '#000000', light: '#ffffff' }
  });
}
```

- [ ] **Step 5: Tests grün**

Run: `pnpm test -- qr` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/qr.ts tests/unit/qr.test.ts package.json pnpm-lock.yaml
git commit -m "feat(qr): SVG generation with ECC-H and length guard"
```

---

### Task 13: Verlauf in LocalStorage

**Files:**
- Create: `tests/unit/history.test.ts`
- Create: `src/lib/history.ts`

- [ ] **Step 1: Failing Tests schreiben**

```ts
// tests/unit/history.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadHistory, addEntry, HISTORY_KEY, HISTORY_LIMIT } from '../../src/lib/history';
import type { HistoryEntry } from '../../src/lib/types';

function entry(label: string, ts = Date.now()): HistoryEntry {
  return {
    id: `id-${label}`,
    label,
    payload: { kind: 'url', value: `https://example.org/${label}` },
    createdAt: ts
  };
}

describe('history (LocalStorage backed)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array when nothing stored', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('persists added entries newest first', () => {
    addEntry(entry('a', 1));
    addEntry(entry('b', 2));
    const list = loadHistory();
    expect(list.map((e) => e.label)).toEqual(['b', 'a']);
  });

  it('caps the list at HISTORY_LIMIT (FIFO)', () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      addEntry(entry(`e${i}`, i));
    }
    const list = loadHistory();
    expect(list.length).toBe(HISTORY_LIMIT);
    expect(list[0].label).toBe(`e${HISTORY_LIMIT + 4}`);
  });

  it('returns [] when stored value has invalid schema', () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([{ totally: 'wrong' }]));
    expect(loadHistory()).toEqual([]);
  });

  it('returns [] when stored value is not JSON', () => {
    localStorage.setItem(HISTORY_KEY, 'not-json');
    expect(loadHistory()).toEqual([]);
  });
});
```

- [ ] **Step 2: Tests fehlschlagen**

Run: `pnpm test -- history` → FAIL.

- [ ] **Step 3: Implementierung**

```ts
// src/lib/history.ts
import type { HistoryEntry, QrPayload } from './types';

export const HISTORY_KEY = 'qr-generator:history:v1';
export const HISTORY_LIMIT = 20;

let memoryFallback: HistoryEntry[] = [];
let useFallback = false;

function safeGet(): string | null {
  if (useFallback) return null;
  try {
    return localStorage.getItem(HISTORY_KEY);
  } catch {
    useFallback = true;
    return null;
  }
}

function safeSet(value: string): void {
  if (useFallback) return;
  try {
    localStorage.setItem(HISTORY_KEY, value);
  } catch {
    useFallback = true;
  }
}

const VALID_KINDS: ReadonlyArray<QrPayload['kind']> = ['url', 'wifi', 'tel', 'vcard', 'text'];

function isValidEntry(e: unknown): e is HistoryEntry {
  if (typeof e !== 'object' || e === null) return false;
  const r = e as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.label !== 'string' || typeof r.createdAt !== 'number')
    return false;
  if (typeof r.payload !== 'object' || r.payload === null) return false;
  const p = r.payload as Record<string, unknown>;
  return typeof p.kind === 'string' && VALID_KINDS.includes(p.kind as QrPayload['kind']);
}

export function loadHistory(): HistoryEntry[] {
  if (useFallback) return [...memoryFallback];
  const raw = safeGet();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
}

export function addEntry(entry: HistoryEntry): void {
  const list = useFallback ? memoryFallback : loadHistory();
  const next = [entry, ...list].slice(0, HISTORY_LIMIT);
  if (useFallback) {
    memoryFallback = next;
    return;
  }
  safeSet(JSON.stringify(next));
  if (useFallback) memoryFallback = next;
}

export function clearHistory(): void {
  memoryFallback = [];
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Tests grün**

Run: `pnpm test -- history` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/history.ts tests/unit/history.test.ts
git commit -m "feat(history): localStorage-backed history with memory fallback"
```

---

### Task 14: Presets-Daten und Validator

**Files:**
- Create: `src/data/presets.json`
- Create: `tests/unit/presets.test.ts`
- Create: `src/lib/presets.ts`

- [ ] **Step 1: `src/data/presets.json` schreiben**

```json
{
  "version": 1,
  "presets": [
    {
      "id": "lage-aktuell",
      "label": "Lage aktuell",
      "icon": "📍",
      "kind": "url",
      "value": "https://einsatz.drk-xy.de/lage"
    },
    {
      "id": "helfer-anmeldung",
      "label": "Helfer-Anmeldung",
      "icon": "🙋",
      "kind": "url",
      "value": "https://einsatz.drk-xy.de/helfer"
    },
    {
      "id": "betreuung-wlan",
      "label": "WLAN Betreuungsstelle",
      "icon": "📶",
      "kind": "wifi",
      "value": { "ssid": "DRK-Gast", "password": "wechselt-pro-einsatz", "encryption": "WPA" }
    }
  ]
}
```

- [ ] **Step 2: Failing Tests schreiben**

```ts
// tests/unit/presets.test.ts
import { describe, it, expect } from 'vitest';
import { validatePresetsFile, getPreset, allPresets } from '../../src/lib/presets';

describe('validatePresetsFile', () => {
  it('accepts a well-formed file', () => {
    expect(() =>
      validatePresetsFile({
        version: 1,
        presets: [{ id: 'a', label: 'A', kind: 'url', value: 'https://x' }]
      })
    ).not.toThrow();
  });

  it('rejects missing version', () => {
    expect(() => validatePresetsFile({ presets: [] })).toThrow();
  });

  it('rejects unsupported kind', () => {
    expect(() =>
      validatePresetsFile({
        version: 1,
        presets: [{ id: 'a', label: 'A', kind: 'bogus', value: 'x' }]
      })
    ).toThrow();
  });

  it('rejects duplicate ids', () => {
    expect(() =>
      validatePresetsFile({
        version: 1,
        presets: [
          { id: 'a', label: 'A', kind: 'url', value: 'https://x' },
          { id: 'a', label: 'B', kind: 'url', value: 'https://y' }
        ]
      })
    ).toThrow();
  });

  it('rejects wifi without ssid', () => {
    expect(() =>
      validatePresetsFile({
        version: 1,
        presets: [
          { id: 'w', label: 'W', kind: 'wifi', value: { ssid: '', password: '', encryption: 'WPA' } }
        ]
      })
    ).toThrow();
  });
});

describe('allPresets / getPreset', () => {
  it('returns the bundled presets', () => {
    const list = allPresets();
    expect(list.length).toBeGreaterThan(0);
  });

  it('finds preset by id', () => {
    expect(getPreset('lage-aktuell')?.label).toBe('Lage aktuell');
  });

  it('returns undefined for unknown id', () => {
    expect(getPreset('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 3: Tests fehlschlagen**

Run: `pnpm test -- presets` → FAIL.

- [ ] **Step 4: Implementierung**

```ts
// src/lib/presets.ts
import type { Preset, QrKind } from './types';
import data from '../data/presets.json';

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

  const seen = new Set<string>();
  for (const p of obj.presets) {
    if (typeof p !== 'object' || p === null) throw new Error('presets: entry not an object');
    const r = p as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id) throw new Error('presets: missing id');
    if (seen.has(r.id)) throw new Error(`presets: duplicate id "${r.id}"`);
    seen.add(r.id);
    if (typeof r.label !== 'string' || !r.label)
      throw new Error(`presets: missing label for "${r.id}"`);
    if (typeof r.kind !== 'string' || !VALID_KINDS.includes(r.kind as QrKind))
      throw new Error(`presets: invalid kind "${String(r.kind)}" for "${r.id}"`);
    if (r.kind === 'wifi') {
      const v = r.value as { ssid?: unknown } | undefined;
      if (!v || typeof v.ssid !== 'string' || !v.ssid)
        throw new Error(`presets: wifi entry "${r.id}" missing ssid`);
    }
    if ((r.kind === 'url' || r.kind === 'tel' || r.kind === 'text') && !r.value)
      throw new Error(`presets: "${r.id}" missing value`);
  }
}

validatePresetsFile(data);

export function allPresets(): Preset[] {
  return (data as PresetsFile).presets;
}

export function getPreset(id: string): Preset | undefined {
  return allPresets().find((p) => p.id === id);
}
```

- [ ] **Step 5: TS-Config für JSON-Import sicherstellen**

In `tsconfig.json` unter `compilerOptions`:

```json
{
  "resolveJsonModule": true,
  "allowSyntheticDefaultImports": true
}
```

(Falls bereits vorhanden, überspringen.)

- [ ] **Step 6: Tests grün**

Run: `pnpm test -- presets` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/presets.ts src/data/presets.json tests/unit/presets.test.ts tsconfig.json
git commit -m "feat(presets): bundled presets with build-time validation"
```

---

### Task 15: Build-Hook für Preset-Validierung

**Files:**
- Create: `scripts/validate-presets.ts`
- Modify: `package.json`

- [ ] **Step 1: Standalone-Validator schreiben**

```ts
// scripts/validate-presets.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VALID_KINDS = ['url', 'wifi', 'tel', 'vcard', 'text'] as const;

const raw = JSON.parse(readFileSync(resolve('src/data/presets.json'), 'utf8'));
if (raw.version !== 1) throw new Error('presets: unsupported version');
if (!Array.isArray(raw.presets)) throw new Error('presets: not an array');

const seen = new Set<string>();
for (const p of raw.presets) {
  if (!p.id || seen.has(p.id)) throw new Error(`presets: bad id "${p.id}"`);
  seen.add(p.id);
  if (!p.label) throw new Error(`presets: "${p.id}" missing label`);
  if (!VALID_KINDS.includes(p.kind))
    throw new Error(`presets: "${p.id}" invalid kind "${p.kind}"`);
  if (p.kind === 'wifi' && !p.value?.ssid)
    throw new Error(`presets: "${p.id}" wifi missing ssid`);
}

console.log(`presets ok (${raw.presets.length} entries)`);
```

- [ ] **Step 2: tsx-Runner installieren**

```bash
pnpm add -D tsx
```

- [ ] **Step 3: Build-Pipeline koppeln**

In `package.json`:

```json
{
  "scripts": {
    "validate:presets": "tsx scripts/validate-presets.ts",
    "prebuild": "pnpm validate:presets",
    "build": "vite build"
  }
}
```

- [ ] **Step 4: Smoke-Test**

Run:
```bash
pnpm validate:presets
```
Expected: `presets ok (3 entries)`.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-presets.ts package.json pnpm-lock.yaml
git commit -m "build: validate presets.json before build"
```

---

## Phase 3: UI-Komponenten

### Task 16: Theme & Basis-Styling

**Files:**
- Modify: `src/app.html`
- Create: `src/app.css`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: `src/app.html` anpassen**

```html
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#000000" />
    <link rel="manifest" href="/manifest.webmanifest" />
    %sveltekit.head%
  </head>
  <body>
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

- [ ] **Step 2: `src/app.css` schreiben**

```css
:root {
  --bg: #ffffff;
  --fg: #000000;
  --muted: #555;
  --accent: #000;
  --tap: 56px;
  color-scheme: light;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 18px;
  -webkit-font-smoothing: antialiased;
}

button,
a.button {
  min-height: var(--tap);
  min-width: var(--tap);
  padding: 0.75rem 1rem;
  font-size: 1.1rem;
  background: var(--fg);
  color: var(--bg);
  border: 2px solid var(--fg);
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

button.secondary,
a.button.secondary {
  background: var(--bg);
  color: var(--fg);
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

input[type='text'],
input[type='url'],
input[type='tel'],
input[type='email'],
input[type='password'] {
  width: 100%;
  min-height: var(--tap);
  padding: 0.75rem 1rem;
  font-size: 1.1rem;
  border: 2px solid var(--fg);
  border-radius: 8px;
  background: var(--bg);
  color: var(--fg);
}
```

- [ ] **Step 3: Layout einbinden**

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<main>{@render children()}</main>

<style>
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 1rem;
  }
</style>
```

- [ ] **Step 4: Smoke-Test im Dev-Server**

Run:
```bash
pnpm dev
```
Browser auf `http://localhost:5173` öffnen. Schwarze Schrift auf weißem Hintergrund. `Ctrl-C`.

- [ ] **Step 5: Commit**

```bash
git add src/app.html src/app.css src/routes/+layout.svelte
git commit -m "style: high-contrast base theme with large tap targets"
```

---

### Task 17: `QrDisplay`-Komponente

**Files:**
- Create: `tests/unit/components/QrDisplay.test.ts`
- Create: `src/lib/components/QrDisplay.svelte`

- [ ] **Step 1: Failing Test**

```ts
// tests/unit/components/QrDisplay.test.ts
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import QrDisplay from '../../../src/lib/components/QrDisplay.svelte';

describe('QrDisplay', () => {
  it('renders an SVG QR for given text', async () => {
    const { container } = render(QrDisplay, { props: { text: 'https://example.org' } });
    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy();
    });
  });

  it('shows error placeholder when text is empty', async () => {
    const { getByText } = render(QrDisplay, { props: { text: '' } });
    expect(getByText(/eingabe leer/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Test fehlschlägt**

Run: `pnpm test -- QrDisplay` → FAIL.

- [ ] **Step 3: Komponente implementieren**

```svelte
<!-- src/lib/components/QrDisplay.svelte -->
<script lang="ts">
  import { payloadToSvg } from '$lib/qr';

  interface Props {
    text: string;
    inverted?: boolean;
  }
  let { text, inverted = false }: Props = $props();

  let svg = $state<string>('');
  let error = $state<string | null>(null);

  $effect(() => {
    if (!text) {
      svg = '';
      error = 'Eingabe leer';
      return;
    }
    error = null;
    let cancelled = false;
    payloadToSvg(text)
      .then((s) => {
        if (!cancelled) svg = s;
      })
      .catch((e: Error) => {
        if (!cancelled) error = e.message;
      });
    return () => {
      cancelled = true;
    };
  });
</script>

{#if error}
  <p class="placeholder">{error}</p>
{:else}
  <div class="qr" class:inverted aria-label="QR-Code">{@html svg}</div>
{/if}

<style>
  .qr {
    display: grid;
    place-items: center;
    background: #fff;
    padding: 1rem;
    border-radius: 8px;
  }
  .qr.inverted {
    background: #000;
    filter: invert(1);
  }
  .qr :global(svg) {
    width: 100%;
    height: auto;
    max-width: 100%;
  }
  .placeholder {
    color: var(--muted);
    text-align: center;
    padding: 2rem;
  }
</style>
```

- [ ] **Step 4: Test grün**

Run: `pnpm test -- QrDisplay` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/QrDisplay.svelte tests/unit/components/QrDisplay.test.ts
git commit -m "feat(ui): QrDisplay component with inverted variant"
```

---

### Task 18: `UrlInput`-Komponente

**Files:**
- Create: `tests/unit/components/UrlInput.test.ts`
- Create: `src/lib/components/UrlInput.svelte`

- [ ] **Step 1: Failing Tests**

```ts
// tests/unit/components/UrlInput.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import UrlInput from '../../../src/lib/components/UrlInput.svelte';

describe('UrlInput', () => {
  it('emits input changes via onChange', async () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(UrlInput, { props: { value: '', onChange } });
    await fireEvent.input(getByLabelText(/url/i), { target: { value: 'https://x' } });
    expect(onChange).toHaveBeenCalledWith('https://x');
  });

  it('warns when over max length', async () => {
    const { getByText } = render(UrlInput, {
      props: { value: 'a'.repeat(2954), onChange: () => {} }
    });
    expect(getByText(/zu lang/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Tests fehlschlagen**

Run: `pnpm test -- UrlInput` → FAIL.

- [ ] **Step 3: Komponente implementieren**

```svelte
<!-- src/lib/components/UrlInput.svelte -->
<script lang="ts">
  import { QR_MAX_LENGTH } from '$lib/qr';

  interface Props {
    value: string;
    onChange: (next: string) => void;
  }
  let { value, onChange }: Props = $props();

  let tooLong = $derived(value.length > QR_MAX_LENGTH);

  async function pasteFromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      onChange(t.trim());
    } catch {
      // user denied — focus is enough
      (document.getElementById('url-field') as HTMLInputElement | null)?.focus();
    }
  }
</script>

<label for="url-field">URL</label>
<div class="row">
  <input
    id="url-field"
    type="url"
    inputmode="url"
    autocomplete="off"
    spellcheck="false"
    placeholder="https://…"
    {value}
    oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
  />
  <button type="button" class="secondary" onclick={pasteFromClipboard}>📋 Einfügen</button>
</div>
{#if tooLong}
  <p class="hint">Eingabe zu lang ({value.length} / {QR_MAX_LENGTH})</p>
{/if}

<style>
  .row {
    display: flex;
    gap: 0.5rem;
  }
  .row input {
    flex: 1;
  }
  .hint {
    color: var(--muted);
    font-size: 0.95rem;
  }
</style>
```

- [ ] **Step 4: Tests grün**

Run: `pnpm test -- UrlInput` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/UrlInput.svelte tests/unit/components/UrlInput.test.ts
git commit -m "feat(ui): UrlInput with clipboard paste and length guard"
```

---

### Task 19: `PresetGrid`-Komponente

**Files:**
- Create: `tests/unit/components/PresetGrid.test.ts`
- Create: `src/lib/components/PresetGrid.svelte`

- [ ] **Step 1: Failing Test**

```ts
// tests/unit/components/PresetGrid.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PresetGrid from '../../../src/lib/components/PresetGrid.svelte';
import type { Preset } from '../../../src/lib/types';

const presets: Preset[] = [
  { id: 'a', label: 'Aktuelle Lage', icon: '📍', kind: 'url', value: 'https://x' },
  { id: 'b', label: 'Helfer', icon: '🙋', kind: 'url', value: 'https://y' }
];

describe('PresetGrid', () => {
  it('renders one button per preset', () => {
    const { getByText } = render(PresetGrid, { props: { presets, onSelect: () => {} } });
    expect(getByText('Aktuelle Lage')).toBeTruthy();
    expect(getByText('Helfer')).toBeTruthy();
  });

  it('invokes onSelect with preset on tap', async () => {
    const onSelect = vi.fn();
    const { getByText } = render(PresetGrid, { props: { presets, onSelect } });
    await fireEvent.click(getByText('Helfer'));
    expect(onSelect).toHaveBeenCalledWith(presets[1]);
  });
});
```

- [ ] **Step 2: Test fehlschlägt**

Run: `pnpm test -- PresetGrid` → FAIL.

- [ ] **Step 3: Komponente implementieren**

```svelte
<!-- src/lib/components/PresetGrid.svelte -->
<script lang="ts">
  import type { Preset } from '$lib/types';

  interface Props {
    presets: Preset[];
    onSelect: (p: Preset) => void;
  }
  let { presets, onSelect }: Props = $props();
</script>

<div class="grid" role="list">
  {#each presets as p (p.id)}
    <button type="button" role="listitem" onclick={() => onSelect(p)}>
      {#if p.icon}<span class="icon" aria-hidden="true">{p.icon}</span>{/if}
      <span class="label">{p.label}</span>
    </button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
  .grid button {
    flex-direction: column;
    min-height: 96px;
    padding: 1rem;
    font-size: 1rem;
    text-align: center;
    white-space: normal;
  }
  .icon {
    font-size: 2rem;
  }
</style>
```

- [ ] **Step 4: Test grün**

Run: `pnpm test -- PresetGrid` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/PresetGrid.svelte tests/unit/components/PresetGrid.test.ts
git commit -m "feat(ui): PresetGrid component"
```

---

### Task 20: `HistoryList`-Komponente

**Files:**
- Create: `src/lib/components/HistoryList.svelte`

- [ ] **Step 1: Komponente implementieren**

```svelte
<!-- src/lib/components/HistoryList.svelte -->
<script lang="ts">
  import type { HistoryEntry } from '$lib/types';

  interface Props {
    entries: HistoryEntry[];
    onSelect: (e: HistoryEntry) => void;
    limit?: number;
  }
  let { entries, onSelect, limit = 5 }: Props = $props();
  let shown = $derived(entries.slice(0, limit));
</script>

{#if shown.length > 0}
  <section aria-label="Verlauf">
    <h2>Verlauf</h2>
    <ul>
      {#each shown as e (e.id)}
        <li>
          <button type="button" class="secondary" onclick={() => onSelect(e)}>
            {e.label}
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }
  li button {
    width: 100%;
    justify-content: flex-start;
  }
  h2 {
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/HistoryList.svelte
git commit -m "feat(ui): HistoryList component"
```

---

### Task 21: Offline-Indikator

**Files:**
- Create: `src/lib/components/OfflineIndicator.svelte`

- [ ] **Step 1: Komponente implementieren**

```svelte
<!-- src/lib/components/OfflineIndicator.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';

  let online = $state(true);

  onMount(() => {
    online = navigator.onLine;
    const on = () => (online = true);
    const off = () => (online = false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  });
</script>

<span class="dot" class:offline={!online} aria-label={online ? 'Online' : 'Offline'}>
  {online ? '🟢' : '🔴'} {online ? 'Online' : 'Offline'}
</span>

<style>
  .dot {
    font-size: 0.9rem;
    color: var(--muted);
  }
  .offline {
    color: var(--fg);
    font-weight: 600;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/OfflineIndicator.svelte
git commit -m "feat(ui): OfflineIndicator using navigator.onLine"
```

---

## Phase 4: Routen

### Task 22: Hauptansicht `/`

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Hauptansicht implementieren**

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import PresetGrid from '$lib/components/PresetGrid.svelte';
  import UrlInput from '$lib/components/UrlInput.svelte';
  import HistoryList from '$lib/components/HistoryList.svelte';
  import OfflineIndicator from '$lib/components/OfflineIndicator.svelte';
  import { allPresets } from '$lib/presets';
  import { payloadToQrString } from '$lib/payload';
  import { loadHistory, addEntry } from '$lib/history';
  import { randomId } from '$lib/uuid';
  import type { Preset, HistoryEntry, QrPayload } from '$lib/types';

  let presets = allPresets();
  let url = $state('');
  let history = $state<HistoryEntry[]>([]);

  onMount(() => {
    history = loadHistory();
  });

  function recordAndNavigate(label: string, payload: QrPayload) {
    const entry: HistoryEntry = {
      id: randomId(),
      label,
      payload,
      createdAt: Date.now()
    };
    addEntry(entry);
    history = loadHistory();
    const params = new URLSearchParams({
      data: payloadToQrString(payload),
      label,
      kind: payload.kind
    });
    goto(`/qr?${params.toString()}`);
  }

  function onPreset(p: Preset) {
    recordAndNavigate(p.label, { kind: p.kind, value: p.value } as QrPayload);
  }

  function onUrlSubmit() {
    if (!url) return;
    recordAndNavigate(url, { kind: 'url', value: url });
  }

  function onHistorySelect(e: HistoryEntry) {
    const params = new URLSearchParams({
      data: payloadToQrString(e.payload),
      label: e.label,
      kind: e.payload.kind
    });
    goto(`/qr?${params.toString()}`);
  }
</script>

<header>
  <h1>QR-Generator</h1>
  <OfflineIndicator />
</header>

<section aria-label="Presets">
  <PresetGrid {presets} onSelect={onPreset} />
</section>

<section aria-label="URL eingeben">
  <UrlInput value={url} onChange={(v) => (url = v)} />
  <button
    type="button"
    disabled={!url || url.length > 1273}
    onclick={onUrlSubmit}
  >
    QR erzeugen
  </button>
</section>

<section aria-label="Weitere Typen" class="more">
  <a class="button secondary" href="/wifi">📶 WLAN</a>
  <a class="button secondary" href="/tel">📞 Telefon</a>
  <a class="button secondary" href="/contact">👤 Kontakt</a>
</section>

<HistoryList entries={history} onSelect={onHistorySelect} />

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  h1 {
    font-size: 1.3rem;
    margin: 0;
  }
  section {
    margin: 1.5rem 0;
  }
  .more {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }
</style>
```

- [ ] **Step 2: Dev-Server-Smoke-Test**

Run: `pnpm dev` → Hauptansicht zeigt Presets, Input und Sekundär-Buttons. `Ctrl-C`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(routes): main view with presets, url input, history"
```

---

### Task 23: Vollbild-QR `/qr`

**Files:**
- Create: `src/routes/qr/+page.svelte`

- [ ] **Step 1: Route implementieren**

```svelte
<!-- src/routes/qr/+page.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import QrDisplay from '$lib/components/QrDisplay.svelte';

  let data = $derived($page.url.searchParams.get('data') ?? '');
  let label = $derived($page.url.searchParams.get('label') ?? '');
  let kind = $derived($page.url.searchParams.get('kind') ?? '');
  let showRawData = $derived(kind !== 'wifi' && kind !== 'vcard');
  let inverted = $state(false);
  let nativeFullscreen = $state(false);
  let cssFullscreen = $state(false);
  let qrEl = $state<HTMLDivElement | null>(null);
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let pressFired = $state(false);

  onMount(() => {
    const onFs = () => {
      nativeFullscreen = !!document.fullscreenElement;
      if (nativeFullscreen) cssFullscreen = false;
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  });

  async function toggleFullscreen() {
    if (pressFired) {
      pressFired = false;
      return;
    }
    if (!qrEl) return;
    if (nativeFullscreen) {
      await document.exitFullscreen?.();
      return;
    }
    if (cssFullscreen) {
      cssFullscreen = false;
      return;
    }
    try {
      await qrEl.requestFullscreen?.();
    } catch {
      cssFullscreen = true;
    }
  }

  function onPressStart() {
    onPressEnd();
    pressFired = false;
    pressTimer = setTimeout(() => {
      inverted = !inverted;
      pressFired = true;
    }, 600);
  }

  function onPressEnd() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }

  async function share() {
    try {
      await navigator.share?.({ title: label || 'QR', text: data });
    } catch {
      // user dismissed
    }
  }

  function downloadPng() {
    const svg = qrEl?.querySelector('svg');
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }
      ctx.fillStyle = inverted ? '#000' : '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (inverted) {
        ctx.filter = 'invert(1)';
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';
      canvas.toBlob((png) => {
        if (!png) {
          URL.revokeObjectURL(url);
          return;
        }
        const pngUrl = URL.createObjectURL(png);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${label || 'qr'}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(pngUrl), 0);
      }, 'image/png');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  let canShare = $state(false);
  onMount(() => {
    canShare = typeof navigator.share === 'function';
  });
  onDestroy(() => onPressEnd());
</script>

<div class="screen" class:css-fullscreen={cssFullscreen}>
  {#if label}
    <h1>{label}</h1>
  {/if}

  <div
    bind:this={qrEl}
    role="button"
    tabindex="0"
    onclick={toggleFullscreen}
    onpointerdown={onPressStart}
    onpointerup={onPressEnd}
    onpointercancel={onPressEnd}
    onkeydown={(e) => e.key === 'Enter' && toggleFullscreen()}
  >
    <QrDisplay text={data} {inverted} />
  </div>

  {#if showRawData}
    <p class="data">{data}</p>
  {/if}
  <p class="hint">Helligkeit auf Maximum für besseres Scannen.</p>

  <div class="actions">
    <button type="button" class="secondary" onclick={toggleFullscreen}>⛶ Vollbild</button>
    {#if canShare}
      <button type="button" class="secondary" onclick={share}>↗ Teilen</button>
    {/if}
    <button type="button" class="secondary" onclick={downloadPng}>⬇ PNG</button>
    <a class="button secondary" href="/">← Zurück</a>
  </div>
</div>

<style>
  .screen {
    display: grid;
    gap: 1rem;
  }
  h1 {
    font-size: 1.5rem;
    text-align: center;
    margin: 0;
  }
  .data {
    font-family: ui-monospace, monospace;
    word-break: break-all;
    text-align: center;
    color: var(--muted);
  }
  .hint {
    text-align: center;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .actions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  .css-fullscreen {
    position: fixed;
    inset: 0;
    background: #fff;
    z-index: 9999;
    padding: 1rem;
    overflow: auto;
  }
</style>
```

- [ ] **Step 2: Manuell prüfen**

Run: `pnpm dev` → Hauptansicht → Preset tippen → QR füllt mind. 80 % der Breite, schwarz auf weiß. `Ctrl-C`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/qr/+page.svelte
git commit -m "feat(routes): fullscreen QR view with invert and share"
```

---

### Task 24: WLAN-Formular `/wifi`

**Files:**
- Create: `src/routes/wifi/+page.svelte`

- [ ] **Step 1: Route implementieren**

```svelte
<!-- src/routes/wifi/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { payloadToQrString } from '$lib/payload';
  import { addEntry } from '$lib/history';
  import { randomId } from '$lib/uuid';

  let ssid = $state('');
  let password = $state('');
  let encryption = $state<'WPA' | 'WEP' | 'nopass'>('WPA');
  let hidden = $state(false);

  let canSubmit = $derived(ssid.trim().length > 0);

  function submit(e: Event) {
    e.preventDefault();
    if (!canSubmit) return;
    const payload = {
      kind: 'wifi' as const,
      value: { ssid: ssid.trim(), password, encryption, hidden }
    };
    addEntry({
      id: randomId(),
      label: `WLAN: ${ssid.trim()}`,
      payload,
      createdAt: Date.now()
    });
    const params = new URLSearchParams({
      data: payloadToQrString(payload),
      label: `WLAN: ${ssid.trim()}`,
      kind: 'wifi'
    });
    goto(`/qr?${params.toString()}`);
  }
</script>

<a class="button secondary back" href="/">← Zurück</a>
<h1>WLAN</h1>

<form onsubmit={submit}>
  <label>
    SSID
    <input type="text" bind:value={ssid} required autocomplete="off" />
  </label>

  <label>
    Passwort
    <input type="text" bind:value={password} autocomplete="off" />
  </label>

  <fieldset>
    <legend>Verschlüsselung</legend>
    <label><input type="radio" bind:group={encryption} value="WPA" /> WPA / WPA2</label>
    <label><input type="radio" bind:group={encryption} value="WEP" /> WEP</label>
    <label><input type="radio" bind:group={encryption} value="nopass" /> Keine</label>
  </fieldset>

  <label class="checkbox">
    <input type="checkbox" bind:checked={hidden} /> Verstecktes Netzwerk
  </label>

  <button type="submit" disabled={!canSubmit}>QR erzeugen</button>
</form>

<style>
  h1 {
    font-size: 1.3rem;
  }
  form {
    display: grid;
    gap: 1rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
  }
  fieldset {
    border: 2px solid var(--fg);
    border-radius: 8px;
    display: grid;
    gap: 0.5rem;
  }
  .checkbox {
    flex-direction: row;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .back {
    display: inline-flex;
    margin-bottom: 1rem;
  }
</style>
```

- [ ] **Step 2: Manuell prüfen**

Run: `pnpm dev` → `/wifi` → SSID „Test" → QR erscheint mit `WIFI:T:WPA;S:Test;...`. `Ctrl-C`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/wifi/+page.svelte
git commit -m "feat(routes): wifi form with encryption and hidden options"
```

---

### Task 25: Telefon-Formular `/tel`

**Files:**
- Create: `src/routes/tel/+page.svelte`

- [ ] **Step 1: Route implementieren**

```svelte
<!-- src/routes/tel/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { payloadToQrString } from '$lib/payload';
  import { addEntry } from '$lib/history';
  import { randomId } from '$lib/uuid';

  let number = $state('');

  function submit(e: Event) {
    e.preventDefault();
    if (!number) return;
    const payload = { kind: 'tel' as const, value: number };
    addEntry({
      id: randomId(),
      label: `Tel: ${number}`,
      payload,
      createdAt: Date.now()
    });
    const params = new URLSearchParams({
      data: payloadToQrString(payload),
      label: `Tel: ${number}`,
      kind: 'tel'
    });
    goto(`/qr?${params.toString()}`);
  }
</script>

<a class="button secondary back" href="/">← Zurück</a>
<h1>Telefon</h1>

<form onsubmit={submit}>
  <label>
    Nummer
    <input type="tel" bind:value={number} placeholder="+4915112345678" required />
  </label>
  <button type="submit" disabled={!number}>QR erzeugen</button>
</form>

<style>
  form {
    display: grid;
    gap: 1rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
  }
  .back {
    display: inline-flex;
    margin-bottom: 1rem;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/tel/+page.svelte
git commit -m "feat(routes): tel form"
```

---

### Task 26: Kontakt/vCard-Formular `/contact`

**Files:**
- Create: `src/routes/contact/+page.svelte`

- [ ] **Step 1: Route implementieren**

```svelte
<!-- src/routes/contact/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { payloadToQrString } from '$lib/payload';
  import { addEntry } from '$lib/history';
  import { randomId } from '$lib/uuid';

  let name = $state('');
  let tel = $state('');
  let email = $state('');
  let org = $state('');

  let canSubmit = $derived(name.trim().length > 0);

  function submit(e: Event) {
    e.preventDefault();
    if (!canSubmit) return;
    const payload = {
      kind: 'vcard' as const,
      value: {
        name: name.trim(),
        tel: tel.trim() || undefined,
        email: email.trim() || undefined,
        org: org.trim() || undefined
      }
    };
    addEntry({
      id: randomId(),
      label: name.trim(),
      payload,
      createdAt: Date.now()
    });
    const params = new URLSearchParams({
      data: payloadToQrString(payload),
      label: name.trim(),
      kind: 'vcard'
    });
    goto(`/qr?${params.toString()}`);
  }
</script>

<a class="button secondary back" href="/">← Zurück</a>
<h1>Kontakt</h1>

<form onsubmit={submit}>
  <label>Name<input type="text" bind:value={name} required /></label>
  <label>Telefon<input type="tel" bind:value={tel} /></label>
  <label>E-Mail<input type="email" bind:value={email} /></label>
  <label>Organisation<input type="text" bind:value={org} /></label>
  <button type="submit" disabled={!canSubmit}>QR erzeugen</button>
</form>

<style>
  form {
    display: grid;
    gap: 1rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
  }
  .back {
    display: inline-flex;
    margin-bottom: 1rem;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/contact/+page.svelte
git commit -m "feat(routes): contact/vCard form"
```

---

## Phase 5: PWA

### Task 27: Service Worker und Manifest

**Files:**
- Modify: `vite.config.ts`
- Create: `static/manifest.webmanifest`
- Create: `static/icons/192.png`, `static/icons/512.png`, `static/icons/maskable.png` (Platzhalter — schwarzer Hintergrund mit weißem „QR")

- [ ] **Step 1: PWA-Plugin und Icon-Tooling installieren**

```bash
pnpm add -D @vite-pwa/sveltekit workbox-window sharp
```

- [ ] **Step 2: `vite.config.ts` anpassen**

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/'
      }
    })
  ]
});
```

- [ ] **Step 3: `static/manifest.webmanifest` schreiben**

```json
{
  "name": "QR-Generator",
  "short_name": "QR",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "orientation": "any",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 4: Reproduzierbares Icon-Generator-Skript schreiben**

`scripts/generate-icons.ts`:

```ts
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve('static/icons');
mkdirSync(OUT, { recursive: true });

function svg(size: number, padding: number): Buffer {
  const fontSize = Math.round(size * 0.45);
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="#000000"/>
      <text x="50%" y="50%" font-family="system-ui, sans-serif" font-weight="700"
            font-size="${fontSize}" fill="#ffffff" text-anchor="middle"
            dominant-baseline="central">QR</text>
    </svg>
  `);
}

async function generate(name: string, size: number, padding: number) {
  const png = await sharp(svg(size, padding)).png().toBuffer();
  writeFileSync(resolve(OUT, name), png);
  console.log(`wrote ${name} (${size}x${size})`);
}

await generate('192.png', 192, 0);
await generate('512.png', 512, 0);
// Maskable: safe-zone 80 % (M3-Spec). Wir füllen alles schwarz, Text bleibt im Zentrum → safe.
await generate('maskable.png', 512, 0);
```

`package.json` ergänzen:

```json
{
  "scripts": {
    "icons": "tsx scripts/generate-icons.ts"
  }
}
```

Run:
```bash
pnpm icons
```
Expected: `static/icons/192.png`, `static/icons/512.png`, `static/icons/maskable.png` existieren und sind valide PNGs.

- [ ] **Step 5: Build-Test**

Run:
```bash
pnpm build
```
Expected: Build erfolgreich, `build/sw.js` und `build/workbox-*.js` werden erzeugt, `build/manifest.webmanifest` und `build/icons/*.png` vorhanden.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts static/ package.json pnpm-lock.yaml
git commit -m "feat(pwa): service worker precache and manifest"
```

---

### Task 28: Update-Prompt-Komponente

**Files:**
- Create: `src/lib/components/UpdatePrompt.svelte`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Komponente schreiben**

```svelte
<!-- src/lib/components/UpdatePrompt.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { useRegisterSW } from 'virtual:pwa-register/svelte';

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      r &&
        setInterval(
          () => {
            r.update();
          },
          60 * 60 * 1000
        );
    }
  });

  let visible = $derived($needRefresh);

  function applyUpdate() {
    updateServiceWorker(true);
  }

  function dismiss() {
    needRefresh.set(false);
  }
</script>

{#if visible}
  <div class="prompt" role="status">
    <span>Update verfügbar</span>
    <button type="button" onclick={applyUpdate}>Anwenden</button>
    <button type="button" class="secondary" onclick={dismiss}>Später</button>
  </div>
{/if}

<style>
  .prompt {
    position: sticky;
    top: 0;
    background: var(--fg);
    color: var(--bg);
    padding: 0.75rem 1rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
    z-index: 100;
  }
  .prompt button {
    min-height: 40px;
    padding: 0.4rem 0.8rem;
    font-size: 0.95rem;
    background: var(--bg);
    color: var(--fg);
  }
  .prompt button.secondary {
    background: var(--fg);
    color: var(--bg);
    border-color: var(--bg);
  }
</style>
```

- [ ] **Step 2: `+layout.svelte` einbinden**

In `src/routes/+layout.svelte` `UpdatePrompt` importieren und vor `<main>` rendern:

```svelte
<script lang="ts">
  import '../app.css';
  import UpdatePrompt from '$lib/components/UpdatePrompt.svelte';
  let { children } = $props();
</script>

<UpdatePrompt />
<main>{@render children()}</main>

<style>
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 1rem;
  }
</style>
```

- [ ] **Step 3: Typings für `virtual:pwa-register/svelte` ergänzen**

In `src/app.d.ts` (ggf. neu anlegen) am Anfang einfügen:

```ts
/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-pwa/svelte" />
```

Run:
```bash
pnpm typecheck
```
Expected: Kein Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/UpdatePrompt.svelte src/routes/+layout.svelte src/app.d.ts
git commit -m "feat(pwa): user-confirmed update prompt"
```

---

## Phase 6: E2E-Tests

### Task 29: Playwright-Setup

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/.gitkeep`
- Modify: `package.json`

- [ ] **Step 1: Playwright installieren**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 2: `playwright.config.ts` schreiben**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
```

- [ ] **Step 3: Script ergänzen**

In `package.json`:

```json
{
  "scripts": {
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 4: Smoke-Test**

`tests/e2e/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('main page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'QR-Generator' })).toBeVisible();
});
```

Run:
```bash
pnpm test:e2e
```
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/smoke.spec.ts package.json pnpm-lock.yaml
git commit -m "test(e2e): configure Playwright with build+preview"
```

---

### Task 30: QR-Decode-Helper (Node-seitig, offline-fähig)

**Files:**
- Create: `tests/e2e/helpers/decode-qr.ts`

**Hintergrund:** Decoding läuft komplett auf der Node-Seite (Playwright-Test-Runner). Wir holen das SVG-Markup aus der Page, rasterisieren es mit `sharp`, decodieren mit dem lokal installierten `jsqr`-npm-Paket. Kein Netzwerk im Browser-Kontext — Voraussetzung für Task 35 (Offline-Test).

- [ ] **Step 1: `jsqr` und `sharp` installieren**

```bash
pnpm add -D jsqr sharp
```

- [ ] **Step 2: Helper schreiben**

```ts
// tests/e2e/helpers/decode-qr.ts
import type { Page } from '@playwright/test';
import sharp from 'sharp';
import jsQR from 'jsqr';

export async function decodeVisibleQr(page: Page): Promise<string> {
  const svgXml = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    if (!svg) throw new Error('no svg in page');
    return new XMLSerializer().serializeToString(svg);
  });

  const size = 512;
  const { data, info } = await sharp(Buffer.from(svgXml))
    .resize(size, size, { fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  if (!code) throw new Error('jsqr could not decode QR');
  return code.data;
}
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/helpers/decode-qr.ts package.json pnpm-lock.yaml
git commit -m "test(e2e): node-side jsqr decode helper with sharp"
```

---

### Task 31: E2E Preset-Flow

**Files:**
- Create: `tests/e2e/preset-flow.spec.ts`

- [ ] **Step 1: Test schreiben**

```ts
// tests/e2e/preset-flow.spec.ts
import { test, expect } from '@playwright/test';
import { decodeVisibleQr } from './helpers/decode-qr';

test('preset tap navigates to QR view and renders scannable QR', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('listitem', { name: /Lage aktuell/i }).click();
  await expect(page).toHaveURL(/\/qr\?/);
  await expect(page.locator('svg')).toBeVisible();
  const decoded = await decodeVisibleQr(page);
  expect(decoded).toBe('https://einsatz.drk-xy.de/lage');
});
```

- [ ] **Step 2: Test grün**

Run:
```bash
pnpm test:e2e preset-flow
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/preset-flow.spec.ts
git commit -m "test(e2e): preset flow round-trip decode"
```

---

### Task 32: E2E URL-Flow

**Files:**
- Create: `tests/e2e/url-flow.spec.ts`

- [ ] **Step 1: Test schreiben**

```ts
// tests/e2e/url-flow.spec.ts
import { test, expect } from '@playwright/test';
import { decodeVisibleQr } from './helpers/decode-qr';

test('typed URL generates matching QR', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('URL').fill('https://example.org/lage');
  await page.getByRole('button', { name: /QR erzeugen/i }).click();
  await expect(page).toHaveURL(/\/qr\?/);
  expect(await decodeVisibleQr(page)).toBe('https://example.org/lage');
});
```

- [ ] **Step 2: Test grün**

Run: `pnpm test:e2e url-flow` → PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/url-flow.spec.ts
git commit -m "test(e2e): url input flow"
```

---

### Task 33: E2E WLAN-Flow

**Files:**
- Create: `tests/e2e/wifi-flow.spec.ts`

- [ ] **Step 1: Test schreiben**

```ts
// tests/e2e/wifi-flow.spec.ts
import { test, expect } from '@playwright/test';
import { decodeVisibleQr } from './helpers/decode-qr';

test('wifi form generates valid WIFI: payload', async ({ page }) => {
  await page.goto('/wifi');
  await page.getByLabel(/SSID/i).fill('DRK-Test');
  await page.getByLabel(/Passwort/i).fill('geheim');
  await page.getByRole('button', { name: /QR erzeugen/i }).click();
  await expect(page).toHaveURL(/\/qr\?/);
  expect(await decodeVisibleQr(page)).toBe('WIFI:T:WPA;S:DRK-Test;P:geheim;H:false;;');
});
```

- [ ] **Step 2: Test grün**

Run: `pnpm test:e2e wifi-flow` → PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/wifi-flow.spec.ts
git commit -m "test(e2e): wifi flow with payload assertion"
```

---

### Task 34: E2E Verlauf

**Files:**
- Create: `tests/e2e/history.spec.ts`

- [ ] **Step 1: Test schreiben**

```ts
// tests/e2e/history.spec.ts
import { test, expect } from '@playwright/test';

test('history fills with last entries and links to QR', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('listitem', { name: /Lage aktuell/i }).click();
  await page.goBack();
  await page.getByRole('listitem', { name: /Helfer-Anmeldung/i }).click();
  await page.goBack();
  await expect(page.getByRole('heading', { name: /Verlauf/i })).toBeVisible();
  await page.getByRole('button', { name: /Helfer-Anmeldung/i }).first().click();
  await expect(page).toHaveURL(/\/qr\?/);
});
```

- [ ] **Step 2: Test grün**

Run: `pnpm test:e2e history` → PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/history.spec.ts
git commit -m "test(e2e): history list flow"
```

---

### Task 35: E2E Offline

**Files:**
- Create: `tests/e2e/offline.spec.ts`

- [ ] **Step 1: Test schreiben**

```ts
// tests/e2e/offline.spec.ts
import { test, expect } from '@playwright/test';
import { decodeVisibleQr } from './helpers/decode-qr';

test('app works offline after first load', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'QR-Generator' })).toBeVisible();
  await page.getByRole('listitem', { name: /Lage aktuell/i }).click();
  expect(await decodeVisibleQr(page)).toBe('https://einsatz.drk-xy.de/lage');
});
```

- [ ] **Step 2: Test grün**

Run: `pnpm test:e2e offline` → PASS.

Falls Test instabil ist (Service-Worker-Controller noch nicht aktiv): zusätzlich `await page.waitForTimeout(500)` vor `setOffline` einfügen.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/offline.spec.ts
git commit -m "test(e2e): offline reload still works"
```

---

### Task 36: E2E PWA-Manifest

**Files:**
- Create: `tests/e2e/pwa-manifest.spec.ts`

- [ ] **Step 1: Test schreiben**

```ts
// tests/e2e/pwa-manifest.spec.ts
import { test, expect } from '@playwright/test';

test('manifest is reachable and has expected fields', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(json.name).toBe('QR-Generator');
  expect(json.short_name).toBe('QR');
  expect(json.display).toBe('standalone');
  expect(Array.isArray(json.icons)).toBe(true);
  expect(json.icons.length).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Test grün**

Run: `pnpm test:e2e pwa-manifest` → PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/pwa-manifest.spec.ts
git commit -m "test(e2e): pwa manifest contract"
```

---

## Phase 7: CI & Deployment

### Task 37: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Workflow schreiben**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm typecheck

      - run: pnpm lint

      - run: pnpm test

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - run: pnpm test:e2e

      - run: pnpm build

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: build/
```

- [ ] **Step 2: Smoke (lokal mit `act` optional, sonst Push)**

Lokal nur Schritte simulieren:
```bash
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
Expected: Kein Fehler.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: full pipeline (typecheck, lint, unit, e2e, build)"
```

---

### Task 38: Manuelle Test-Checkliste

**Files:**
- Create: `docs/manual-test.md`

- [ ] **Step 1: Checkliste schreiben**

```markdown
# Manuelle Test-Checkliste — QR-Generator

Vor jedem Release auf einem realen Smartphone (iOS Safari + Android Chrome) durchführen.

## Installation
- [ ] PWA installiert sich (Add to Home Screen) ohne aggressiven Auto-Prompt
- [ ] Icon erscheint auf Home-Screen und wirkt nicht abgeschnitten

## Scan-Reichweite
- [ ] Drei Presets aus 50 cm mit zweitem Smartphone scannbar
- [ ] Drei Presets im Vollbild aus 1,5 m scannbar
- [ ] Invertierter QR (Long-Press) ebenfalls scannbar

## Offline
- [ ] App geladen → Flugmodus → Reload → Hauptansicht funktioniert
- [ ] Preset im Flugmodus → QR erscheint
- [ ] WLAN-Flow im Flugmodus

## Real-World
- [ ] Generierter WLAN-QR verbindet zweites Gerät tatsächlich (WPA, leeres Passwort, Sonderzeichen im SSID)
- [ ] Tel-QR öffnet Telefon-App
- [ ] vCard-QR fügt Kontakt hinzu

## Update
- [ ] Neue Version deployed → Update-Badge erscheint → „Später" funktioniert (kein Reload)
- [ ] „Anwenden" lädt neue Version

## Bedienung
- [ ] Tap-Targets fühlen sich groß an (Handschuhe oder Stress simulieren)
- [ ] Maximale Helligkeit verbessert Scan-Distanz spürbar
```

- [ ] **Step 2: Commit**

```bash
git add docs/manual-test.md
git commit -m "docs: manual test checklist"
```

---

### Task 39: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: README schreiben**

```markdown
# QR-Generator

Offline-fähige PWA für schnelle QR-Code-Erzeugung im Katastrophenschutz-Einsatz.

## Setup

```bash
pnpm install
pnpm dev
```

## Skripte

| Script | Beschreibung |
|---|---|
| `pnpm dev` | Entwicklungsserver |
| `pnpm build` | Produktions-Build (validiert vorher `presets.json`) |
| `pnpm preview` | Vorschau des Builds |
| `pnpm test` | Unit-Tests (Vitest) |
| `pnpm test:e2e` | E2E-Tests (Playwright) |
| `pnpm lint` | ESLint + Prettier-Check |
| `pnpm typecheck` | svelte-check + tsc --noEmit |

## Presets anpassen

`src/data/presets.json` editieren — wird beim Build validiert.

## Deployment

Static Build (`build/`) auf Cloudflare Pages. Output-Dir: `build`.

## Manuelle Tests

Siehe `docs/manual-test.md`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with setup and scripts"
```

---

### Task 40: Cloudflare-Pages-Konfiguration

**Files:**
- Create: `.nvmrc` (optional), README-Eintrag

- [ ] **Step 1: Build-Settings dokumentieren**

In Cloudflare-Pages-Dashboard (manuell durch Nutzer):

- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Build output directory: `build`
- Root directory: (leer)
- Environment variable: `NODE_VERSION=20`, `PNPM_VERSION=9.12.0` (an `packageManager` anpassen)

Diese Einstellungen in `README.md` ergänzen:

```markdown
## Cloudflare-Pages-Konfiguration

- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Output: `build`
- ENV: `NODE_VERSION=20`
```

- [ ] **Step 2: `.nvmrc` schreiben**

```
20
```

- [ ] **Step 3: Commit**

```bash
git add .nvmrc README.md
git commit -m "docs: cloudflare pages configuration notes"
```

---

## Phase 8: Abschluss

### Task 41: Bundle-Größe prüfen

- [ ] **Step 1: Build & Größen-Messung**

Run:
```bash
pnpm build
du -sh build/_app build/sw.js build/workbox-*.js 2>/dev/null
find build -name '*.js' -o -name '*.css' | xargs -I {} sh -c 'gzip -c "{}" | wc -c | tr -d " " | xargs -I% printf "%s\t%s\n" "{}" "%"' | sort -k2 -n
```

Erwartung: gzipped-Summe der App-Assets (ohne `qrcode`-Lib) < 100 KB. `qrcode` selbst ist ~15 KB gzip. Falls deutlich über 100 KB → Investigation (Source-Map-Explorer einsetzen).

- [ ] **Step 2: Optional `vite-bundle-visualizer` für Diagnose**

Falls Budget überschritten:
```bash
pnpm dlx vite-bundle-visualizer
```
und prüfen, ob unnötige Polyfills oder Mehrfach-Bundles auftauchen.

- [ ] **Step 3: Commit**

Falls keine Änderungen nötig: kein Commit. Sonst entsprechende Fixes committen.

---

### Task 42: Gesamtlauf grün

- [ ] **Step 1: Volle Pipeline lokal**

Run:
```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e && pnpm build
```
Expected: Alle Schritte grün.

- [ ] **Step 2: Manuelle Test-Checkliste**

`docs/manual-test.md` mit einem realen Smartphone abarbeiten (außerhalb der Plan-Ausführung — durch den Einsatzleiter / Tester).

- [ ] **Step 3: Final Commit (optional)**

```bash
git tag v0.1.0
git commit --allow-empty -m "release: v0.1.0"
```
