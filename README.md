# QR-Generator

Offline-fähige PWA für schnelle QR-Code-Erzeugung im Katastrophenschutz-Einsatz. Presets liegen in einer Cloudflare-D1-Datenbank, gepflegt über eine Admin-UI mit Pocket-ID-Login.

## Lokales Setup

```bash
pnpm install
pnpm wrangler d1 create drk-qr-presets        # einmalig — `database_id` in wrangler.toml übernehmen
pnpm wrangler d1 migrations apply drk-qr-presets --local
cp .dev.vars.example .dev.vars                 # Pocket-ID-Credentials eintragen
pnpm dev
```

Die anonyme QR-Generierung funktioniert auch ohne Pocket-ID-Login.

## Skripte

| Script                  | Beschreibung                                 |
| ----------------------- | -------------------------------------------- |
| `pnpm dev`              | Entwicklungsserver (Vite + lokales D1)       |
| `pnpm build`            | Produktions-Build (`adapter-cloudflare`)     |
| `pnpm preview`          | Vorschau des Builds                          |
| `pnpm test`             | Unit-Tests (Vitest, Node)                    |
| `pnpm test:integration` | Integrationstests (Vitest Workers Pool + D1) |
| `pnpm test:all`         | Unit- + Integrationstests nacheinander       |
| `pnpm test:e2e`         | E2E-Tests (Playwright)                       |
| `pnpm lint`             | ESLint + Prettier-Check                      |
| `pnpm typecheck`        | svelte-check + tsc --noEmit                  |

## Presets verwalten

Im Browser auf `/admin` (mit Admin-Rolle in Pocket ID): Anlegen, Bearbeiten, Sortieren, Löschen. Daten landen in der D1-Datenbank — kein Repo-Commit nötig.

## Deployment (Cloudflare Pages)

1. Build-Command: `pnpm install --frozen-lockfile && pnpm build`
2. Output: `.svelte-kit/cloudflare`
3. Vor dem ersten Deploy:
   ```bash
   pnpm wrangler d1 migrations apply drk-qr-presets --remote
   pnpm wrangler pages secret put POCKET_ID_CLIENT_SECRET
   pnpm wrangler pages secret put SESSION_SECRET
   ```
4. Pocket-ID-App konfigurieren:
   - Redirect-URI: `https://<host>/auth/callback`
   - Scopes: `openid profile email groups`
   - Gruppen: `drk-qr-admin`, `drk-qr-user`

## Architektur

- Frontend: SvelteKit 2 + Svelte 5, statisch für die Kern-Routen, dynamische `/api/...` und `/auth/...` als Workers.
- Datenhaltung: Cloudflare D1 (SQLite). Migrationen unter `migrations/`.
- Auth: Pocket ID via OIDC PKCE (Library: `arctic`), Sessions als signierte HttpOnly-Cookies in D1.
- PWA: Service-Worker NetworkFirst auf `/api/presets` (Offline-Fallback für eingeloggte Nutzer:innen).

## Manuelle Tests

Siehe `docs/manual-test.md`.
