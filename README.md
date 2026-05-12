# QR-Generator

Offline-fähige PWA für schnelle QR-Code-Erzeugung im Katastrophenschutz-Einsatz.

## Setup

```bash
pnpm install
pnpm dev
```

## Skripte

| Script           | Beschreibung                                        |
| ---------------- | --------------------------------------------------- |
| `pnpm dev`       | Entwicklungsserver                                  |
| `pnpm build`     | Produktions-Build (validiert vorher `presets.json`) |
| `pnpm preview`   | Vorschau des Builds                                 |
| `pnpm test`      | Unit-Tests (Vitest)                                 |
| `pnpm test:e2e`  | E2E-Tests (Playwright)                              |
| `pnpm lint`      | ESLint + Prettier-Check                             |
| `pnpm typecheck` | svelte-check + tsc --noEmit                         |

## Presets anpassen

`src/data/presets.json` editieren — wird beim Build validiert.

## Deployment

Static Build (`build/`) auf Cloudflare Pages. Output-Dir: `build`.

## Manuelle Tests

Siehe `docs/manual-test.md`.
