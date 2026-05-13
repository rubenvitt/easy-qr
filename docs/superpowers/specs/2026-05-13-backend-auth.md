# Backend & Auth — Design-Dokument

**Datum:** 2026-05-13
**Status:** Entwurf
**Kontext:** Erweiterung des QR-Generators um serverseitige Presets-Verwaltung mit Pocket ID Authentifizierung
**Baut auf:** `2026-05-12-qr-generator-design.md`

---

## 1. Ziel und Kontext

Die Presets enthalten sensible Daten (z. B. WLAN-Passwörter für Einsatz-Hotspots, interne URLs). Sie dürfen nicht ins Git-Repo oder ins Public-Bundle. Daher:

- Presets ziehen vom Repo in eine serverseitige Datenbank um.
- Pflege der Presets erfolgt über eine Admin-UI im Browser, geschützt durch Pocket ID Login.
- Lesen der Presets erfolgt für eingeloggte Nutzer:innen mit Rolle `user` oder `admin`.
- Anonym (ohne Login): QR-Generator funktioniert weiter (URL/WLAN/Tel/Kontakt-Formulare), aber kein Preset-Grid und kein Verlauf-Sync.

**Leitprinzipien bleiben:**

- Offline-First für die Kern-Generierung — die Auth-bezogenen Bereiche dürfen online sein.
- Stress-resistente UX: anonyme Nutzung führt sofort zur Hauptfunktion (kein Login-Wall).
- Robust: Build-Zeit-Validierung wird zu Server-Side-Validierung beim Schreiben.

---

## 2. Technologie-Stack-Ergänzungen

| Bereich         | Wahl                                                                                | Begründung                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Hosting         | **Cloudflare Pages** (unverändert) + **Workers** via `@sveltejs/adapter-cloudflare` | Hybrid-Adapter: statische Routes prerendered, dynamische API-Routes auf Workers; kein zusätzlicher Service |
| Datenbank       | **Cloudflare D1** (SQLite)                                                          | Kostenlos bis 5 GB, eingebaute Migrationen via `wrangler d1 migrations`, gut für strukturierte Presets     |
| Auth-Provider   | **Pocket ID** (self-hosted OIDC)                                                    | Bestehender DRK-Login                                                                                      |
| OIDC-Client     | **`arctic`** + **`oslo`**                                                           | Schlank, typisiert, gut für SvelteKit                                                                      |
| Session-Storage | **Cookie-Sessions** (signed) in D1-Tabelle `sessions`                               | Einfacher als JWT, sofort widerrufbar                                                                      |
| Local Dev       | **Wrangler** für Workers/D1-Emulation                                               | `pnpm dev` startet Vite + Wrangler-Dev                                                                     |

**Adapter-Wechsel:** `adapter-static` → `adapter-cloudflare`. Alle bisherigen Routen bleiben prerendered via `export const prerender = true`. Dynamische Routen (`/api/...`, `/admin/...`) bekommen `prerender = false`.

---

## 3. Datenmodell (D1)

### Tabelle `presets`

```sql
CREATE TABLE presets (
  id TEXT PRIMARY KEY,             -- slug, eindeutig
  label TEXT NOT NULL,
  icon TEXT,                       -- optional, Emoji oder kurzer String
  kind TEXT NOT NULL,              -- 'url' | 'wifi' | 'tel' | 'vcard' | 'text'
  value TEXT NOT NULL,             -- JSON-serialisiert (Schema je nach kind)
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,        -- user.id
  updated_by TEXT NOT NULL
);

CREATE INDEX idx_presets_sort ON presets (sort_order, label);
```

### Tabelle `users` (gespiegelt aus Pocket ID)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,             -- Pocket ID 'sub' claim
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL,              -- 'user' | 'admin'
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);
```

### Tabelle `sessions`

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,             -- random 32-byte hex
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions (user_id);
```

### Optional: Tabelle `audit_log` (nice-to-have, später)

Wer hat wann welches Preset geändert? Klein anfangen, ggf. erweitern.

---

## 4. Rollen & Berechtigungen

| Aktion                                | anonym | user | admin |
| ------------------------------------- | ------ | ---- | ----- |
| QR generieren (URL/WLAN/Tel/Kontakt)  | ✅     | ✅   | ✅    |
| Verlauf (LocalStorage)                | ✅     | ✅   | ✅    |
| Presets sehen                         | ❌     | ✅   | ✅    |
| Preset anlegen / bearbeiten / löschen | ❌     | ❌   | ✅    |
| Sortier-Reihenfolge ändern            | ❌     | ❌   | ✅    |

**Rollen-Mapping aus Pocket ID:**

- Pocket-ID-Gruppe `drk-qr-admin` → `admin`
- Pocket-ID-Gruppe `drk-qr-user` → `user`
- Nutzer:innen ohne passende Gruppe → 403 nach Login (Hinweis: „Kein Zugriff — bitte Admin kontaktieren")

Mapping passiert in `/auth/callback` beim ersten Login und wird bei jedem Login aktualisiert (falls Gruppen sich ändern).

---

## 5. API-Routen

Alle unter SvelteKit `+server.ts` als Workers-Endpoints. JSON In/Out. Auth via Cookie-Session.

### `GET /api/presets`

- **Auth:** user oder admin
- **Response:** `{ version: 1, presets: Preset[] }` (sortiert nach `sort_order`)
- **Caching:** `Cache-Control: private, max-age=60` — Frontend cached lokal über Service-Worker

### `POST /api/presets`

- **Auth:** admin
- **Body:** `Preset` ohne `id` (Server generiert slug aus `label`, dedupliziert mit `-2` etc.)
- **Response:** `Preset` mit generierter `id`, oder `400` bei Validierungsfehler

### `PUT /api/presets/:id`

- **Auth:** admin
- **Body:** vollständiger `Preset` (alle Felder)
- **Response:** aktualisierter `Preset`

### `DELETE /api/presets/:id`

- **Auth:** admin
- **Response:** `204`

### `POST /api/presets/reorder`

- **Auth:** admin
- **Body:** `{ ids: string[] }` (neue Reihenfolge)
- **Response:** `204`

### `GET /auth/login`

- Startet OIDC-Flow: redirect zu Pocket ID `/authorize` mit `state` + `code_verifier` in HttpOnly-Cookies

### `GET /auth/callback?code&state`

- Tauscht Code gegen Token, holt UserInfo, ermittelt Rolle aus Gruppen, lege User+Session an
- Redirect zurück zu vorheriger Page (default: `/`)

### `POST /auth/logout`

- Löscht Session aus D1 und Cookie
- Optional: Pocket ID `end_session_endpoint` aufrufen (single sign-out)

### `GET /api/me`

- **Auth:** beliebig
- **Response:** `{ user: { id, email, displayName, role } | null }`
- Frontend verwendet das zum Conditional-Rendering

### Validierung

Server-seitiger Validator orientiert sich an `src/lib/presets.ts::validatePresetsFile`, aber pro Preset:

- `id`: optional bei POST, slug-Format `[a-z0-9-]+`
- `label`: non-empty, max 80 chars
- `kind`: aus den 5 erlaubten Werten
- `value`: JSON-Shape je nach `kind` (gleiche Regeln wie `payload.ts`)
- Eindeutigkeit von `id` per DB-Constraint

---

## 6. Frontend-Änderungen

### Adapter-Wechsel

`svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-cloudflare';
```

`src/routes/+layout.ts` bleibt `ssr = false` (Client-only), aber `prerender = true` nur für statische Routen. API-Routen prerendern nicht.

### Hauptansicht (`/`)

- `loadPresets()` als Fetch von `/api/presets` (statt build-time Import)
- Bei `401`: Preset-Grid wird einfach nicht gerendert (kein Login-Wall)
- Bei `200`: Grid wie gehabt
- Service-Worker: Network-First mit Cache-Fallback für `/api/presets` (siehe Abschnitt 7)

### Header-Anpassung

- Wenn nicht eingeloggt: kleiner Login-Button („🔑 Anmelden")
- Wenn eingeloggt als `user`: Display-Name + Logout
- Wenn eingeloggt als `admin`: Display-Name + Logout + Admin-Link („⚙️ Verwalten")

### Admin-Seite (`/admin`)

- **Route-Guard:** `+page.server.ts` prüft Session, `redirect(302, '/auth/login?return=/admin')` bei fehlend
- **Liste der Presets** mit Inline-Edit oder Modal
- **Neu anlegen** Button
- **Drag-und-drop Sortierung** (oder einfach Up/Down-Buttons — drag-and-drop ist Touch-feindlich; gehen wir mit Up/Down)
- **Löschen** mit Bestätigung
- Form-Felder je nach `kind` (URL/WLAN/Tel/vCard/Text) — wiederverwendet aus den existierenden Routen-Formularen

### Login-Flow

- Klick auf „Anmelden" → `/auth/login?return=<current-path>`
- Server redirected zu Pocket ID
- Pocket ID redirected zurück zu `/auth/callback`
- Server holt Token, legt Session an, Cookie setzen
- Redirect zur `return`-URL

### Hidden Optionen

- `/auth/me` liefert User-Info — vom Frontend beim Mount aufgerufen, das Ergebnis wird in einem Svelte-Store gehalten, damit alle Komponenten Auth-State sehen können

---

## 7. PWA-Anpassungen

### Service Worker

- `manifest`-Strategie wechselt nicht — weiterhin `generateSW` mit `registerType: 'prompt'`
- Workbox `runtimeCaching` ergänzen:
  - `/api/presets`: **NetworkFirst** mit 2 s timeout, Fallback auf Cache (Offline → letzte bekannte Presets)
  - `/api/me`: **NetworkFirst** ohne Cache-Fallback (Auth-State muss frisch sein)
  - `/auth/*`: kein Cache (immer Live)

### Offline-Verhalten

- Wenn User eingeloggt war und Presets bereits cached: offline weiterhin volle Funktion mit Preset-Grid
- Wenn anonym: offline funktioniert wie bisher (ohne Presets)
- Login selbst funktioniert nur online

### Update-Logik

- Bleibt bei `registerType: 'prompt'` — wichtiger denn je, da DB-Schema-Migrationen serverseitig sind und Client mit altem Schema reden muss

---

## 8. Sicherheit

### Threat Model

| Bedrohung                  | Mitigation                                                        |
| -------------------------- | ----------------------------------------------------------------- |
| Token-Diebstahl via XSS    | HttpOnly-Cookies, kein localStorage für Tokens                    |
| CSRF auf Mutations         | SameSite=Strict-Cookies + Origin-Check im Handler                 |
| Brute-Force Login          | Pocket ID handelt das (Rate-Limit, MFA)                           |
| Session-Hijack             | Sessions binden an Cookie-Wert; bei Logout server-seitig gelöscht |
| Preset-Tampering           | Admin-Rolle Server-side geprüft, nicht client-side                |
| SQL-Injection              | D1 `bind()` für alle User-Inputs, kein String-Concat              |
| Open-Redirect via `return` | Allowlist auf eigene Origin im `/auth/callback`                   |

### Secrets-Handling

- Pocket ID Client-Secret in Cloudflare Pages Environment Variables (encrypted at rest)
- `wrangler.toml` hat Platzhalter, echte Werte via `wrangler secret put`
- Lokal: `.dev.vars` (in `.gitignore`)

### Audit / Logging

- Bei jedem Login: `users.last_login_at` aktualisieren
- Bei jedem Mutation-Endpoint: optional `audit_log` schreiben (Phase 2)

---

## 9. Migration der bestehenden Presets

Das eingecheckte `src/data/presets.json` enthält noch sensitive Dummy-Daten. Migrationspfad:

1. **Schreiben einer einmaligen Seed-Migration** in `migrations/0002_seed_presets.sql` — aber **nicht mit Echt-Daten**! Nur ein generisches Beispiel (z. B. einen Demo-URL-Preset).
2. **`src/data/presets.json` wird gelöscht** — bzw. ersetzt durch eine leere Default-Struktur, die nur greift falls die DB komplett leer ist (Bootstrap-Fallback). Aktuell ist das aber nicht nötig — leere Preset-Liste ist okay.
3. **Echt-Daten** werden vom Admin nach Deploy über das UI angelegt.

`src/lib/presets.ts`:

- `validatePresetsFile` und `validatePreset` bleiben (Server-seitig verwendet)
- `allPresets()` / `getPreset()` entfallen oder werden zu Fetch-Wrappern

`scripts/validate-presets.ts`:

- entfällt (Build-Zeit-Validierung passt nicht mehr; Validierung läuft beim API-Call)

`prebuild` in `package.json`:

- entfernen

---

## 10. Lokales Entwickeln

### Dev-Setup

```bash
pnpm install
pnpm wrangler d1 create drk-qr-presets             # einmalig, gibt database_id zurück
# wrangler.toml mit database_id ausfüllen
pnpm wrangler d1 migrations apply drk-qr-presets --local
cp .dev.vars.example .dev.vars                      # Pocket ID Client-ID/Secret eintragen
pnpm dev                                            # Vite + Wrangler-Dev-Worker
```

### `.dev.vars` (gitignored)

```
POCKET_ID_ISSUER=https://id.drk-xy.de
POCKET_ID_CLIENT_ID=...
POCKET_ID_CLIENT_SECRET=...
POCKET_ID_REDIRECT_URI=http://localhost:5173/auth/callback
SESSION_SECRET=...     # zufällige 32-byte hex, zum Cookie-Signieren
```

### `wrangler.toml`

```toml
name = "drk-qr-generator"
compatibility_date = "2026-05-01"
pages_build_output_dir = ".svelte-kit/cloudflare"

[[d1_databases]]
binding = "DB"
database_name = "drk-qr-presets"
database_id = "..."

[vars]
# Nicht-sensitive
```

---

## 11. Deployment

### Cloudflare Pages

Build-Konfiguration:

- **Build command:** `pnpm install --frozen-lockfile && pnpm build`
- **Output dir:** `.svelte-kit/cloudflare`
- **Env Vars (Production):** alle aus `.dev.vars` als Pages-Secrets

Vor dem ersten Deploy:

```bash
pnpm wrangler d1 migrations apply drk-qr-presets --remote
pnpm wrangler pages secret put POCKET_ID_CLIENT_SECRET
pnpm wrangler pages secret put SESSION_SECRET
```

Pocket-ID-Application konfigurieren:

- Redirect-URI: `https://qr.drk-xy.de/auth/callback`
- Scopes: `openid profile email groups`
- Groups-Mapping: `drk-qr-admin`, `drk-qr-user`

---

## 12. Tests

### Erweiterungen

- **Unit:** Auth-Helper (Cookie-Parsing, Session-Validation, Role-Mapping aus Token-Claims)
- **Integration:** Per `@cloudflare/vitest-pool-workers` API-Endpoints gegen lokale D1
- **E2E:**
  - Mock Pocket ID via `@playwright/test` Network-Intercept oder lokaler OIDC-Mock
  - Flow: anonym → Login → User-Rolle → Presets sichtbar
  - Flow: Admin → Preset anlegen → erscheint in Liste
  - Flow: Offline mit cached Presets → Liste sichtbar

### CI-Ergänzung

- Vor `pnpm build` Migrationen anwenden gegen lokale D1: `wrangler d1 migrations apply --local`
- Secrets in CI: GitHub-Actions-Secrets, an Wrangler weitergereicht

---

## 13. Fehlerfälle & Edge Cases (Ergänzungen)

| Szenario                                               | Verhalten                                                            |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `/api/presets` Network-Error (offline, nie cached)     | Empty-State im Grid, kein Fehler-Toast                               |
| Pocket-ID nicht erreichbar beim Login                  | Fehlerseite mit Retry-Link + Hinweis: anonyme Nutzung weiter möglich |
| Session-Cookie abgelaufen, User klickt Admin-Aktion    | 401 → Frontend redirected zu `/auth/login` mit `return=current-path` |
| Admin löscht Preset, anderer Admin-Tab hat Stand davor | Optimistisch löschen, bei 404 von Server: Liste neu laden            |
| User-Rolle wird im Pocket ID gegen `none` geändert     | Beim nächsten Token-Refresh erkennt Server → Session invalidiert     |
| Preset-Slug-Kollision                                  | Server hängt `-2`, `-3` ... an                                       |
| D1 nicht erreichbar                                    | 503 zurück, Frontend zeigt „Wartung — bitte später erneut versuchen" |

---

## 14. Out of Scope (für v2)

- Audit-Log mit UI
- Mehrere DRK-Mandanten / Multi-Tenancy
- Push-Notifications bei Preset-Updates
- Bulk-Import/Export von Presets
- Granulareres Rollen-Modell (z. B. „Editor" zwischen User und Admin)
- Self-Service-Registrierung (alles läuft über Pocket ID Admin)

---

## 15. Erfolgs-Kriterien

- Anonyme Nutzung: 3-Tap-Pfad weiterhin erfüllt (URL/WLAN/Tel/Kontakt, kein Login-Wall)
- User-Login: Preset-Grid erscheint binnen 1 s nach Login
- Admin: Neuanlage eines Presets dauert < 30 s (Form ausfüllen + Speichern)
- Offline-Nutzung für eingeloggte User: vollständige Funktion bis 24 h nach letztem Sync
- Pocket-ID-Login-Roundtrip: < 3 s (inkl. Discovery)
- Bundle-Größe bleibt unter 200 KB gzip (von 100 KB; Auth + Forms erlauben Wachstum)

---

## 16. Offene Fragen

- Soll der Verlauf (History) serverseitig synchronisieren, oder bleibt er pro Gerät? **Empfehlung:** pro Gerät (privater, kein Sync-Aufwand)
- Soll das Frontend ohne Login einen sichtbaren Hinweis zeigen („Mit Login mehr Presets verfügbar")? **Empfehlung:** subtiler Hinweis im Header bei Login-Button
- Admin-Form: alle 5 `kind`s als ein Wizard, oder separate Tabs? **Empfehlung:** Tabs, da Felder sehr unterschiedlich sind
