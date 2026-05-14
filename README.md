# QR-Generator

Offline-fähige PWA für schnelle QR-Code-Erzeugung im Katastrophenschutz-Einsatz. Presets liegen in einer lokalen SQLite-Datenbank, gepflegt über eine Admin-UI mit Pocket-ID-Login.

## Lokales Setup

```bash
pnpm install
cp .env.example .env                            # Pocket-ID-Credentials und SESSION_SECRET eintragen
# SESSION_SECRET erzeugen: openssl rand -hex 32
pnpm dev
```

Die SQLite-Datei wird beim ersten Start automatisch unter `./data/app.db` angelegt; Migrationen aus `migrations/` werden automatisch beim Start angewandt. Die anonyme QR-Generierung funktioniert auch ohne Pocket-ID-Login.

## Skripte

| Script           | Beschreibung                                          |
| ---------------- | ----------------------------------------------------- |
| `pnpm dev`       | Entwicklungsserver (Vite)                             |
| `pnpm build`     | Produktions-Build (adapter-node, Output unter `build/`) |
| `pnpm start`     | Produktion: `node build/index.js`                     |
| `pnpm preview`   | Vorschau des Builds                                   |
| `pnpm test`     | Unit- und Server-Tests (Vitest)                       |
| `pnpm test:e2e` | E2E-Tests (Playwright)                                |
| `pnpm lint`      | ESLint + Prettier-Check                               |
| `pnpm typecheck` | svelte-check + tsc --noEmit                           |

## Presets verwalten

Im Browser auf `/admin` (mit Admin-Rolle in Pocket ID): Anlegen, Bearbeiten, Sortieren, Löschen. Daten landen in der SQLite-Datenbank — kein Repo-Commit nötig.

## Deployment (Docker)

Image lokal bauen:

```bash
docker build -t qr-generator .
```

Oder aus GHCR ziehen (Image-Name entsprechend Repository anpassen):

```bash
docker pull ghcr.io/<owner>/<repo>:latest
```

Container via Compose starten:

```bash
docker compose up -d
```

Hinweise:

- Volume `./data` mounten, damit die SQLite-Datei (`DB_PATH`) persistent bleibt.
- Umgebungsvariablen gemäß `.env.example` setzen (Pocket-ID-Credentials, `SESSION_SECRET`, `APP_ORIGIN`, ggf. `PORT`/`HOST`).
- TLS und öffentliche Erreichbarkeit über einen vorgeschalteten Reverse-Proxy (Traefik, Caddy oder nginx) terminieren.

### Pocket-ID-App konfigurieren

- Redirect-URI: `https://<host>/auth/callback`
- Scopes: `openid profile email groups`
- Gruppen: per Default `drk-qr-admin` (Admin-Rolle) und `drk-qr-user` (User-Rolle). Über die Environment-Variablen `OIDC_ADMIN_GROUPS` und `OIDC_USER_GROUPS` (Komma-getrennt) können beliebige andere Gruppennamen gemappt werden. Wer in beiden Listen ist, bekommt `admin`.

## Architektur

- Frontend: SvelteKit 2 + Svelte 5 mit `@sveltejs/adapter-node` (Standalone-Node-Server unter `build/`).
- Datenhaltung: lokale SQLite-Datei via `better-sqlite3`. Migrationen liegen unter `migrations/` und werden beim Start automatisch angewandt.
- Auth: Pocket ID via OIDC PKCE (Library: `arctic`), Sessions als signierte HttpOnly-Cookies, persistiert in der SQLite-Datenbank.
- PWA: Service-Worker NetworkFirst auf `/api/presets` (Offline-Fallback für eingeloggte Nutzer:innen).

## Manuelle Tests

Siehe `docs/manual-test.md`.
