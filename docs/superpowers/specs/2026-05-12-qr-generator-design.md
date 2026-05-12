# QR-Generator — Design-Dokument

**Datum:** 2026-05-12
**Status:** Genehmigt (durch Nutzer im Brainstorming-Flow)
**Kontext:** DRK-Einsatzunterstützung — schnelles Teilen von Links via QR-Code im Katastrophenschutz

---

## 1. Ziel und Kontext

Eine simple, robuste Web-Anwendung (PWA), die im Einsatzfall des Katastrophenschutzes blitzschnell QR-Codes erzeugt, um Links (Lageinfo, Helfer-Anmeldung, Spendenseiten, WLAN-Zugänge usw.) an Helfer:innen, Betroffene und andere Einsatzkräfte zu verteilen.

**Leitprinzipien:**

- **Offline-First:** Funktioniert auch ohne Mobilfunk.
- **Stress-resistente UX:** Wenige, große, eindeutige Bedienelemente.
- **Robust:** Wenige Abhängigkeiten, keine externen Aufrufe zur Laufzeit, Build-Zeit-Validierung.
- **Neutral & funktional:** Kein DRK-Branding, maximaler Kontrast, fokussiert auf Funktion.

**Worst-Case-Workflow als Messlatte:**
Drei Taps vom Home-Screen zu einem scannbaren Vollbild-QR — komplett offline.

---

## 2. Technologie-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Framework | **SvelteKit** mit `@sveltejs/adapter-static` | Reaktivität ohne Overhead, sehr kleines Bundle, eingebautes Routing |
| Sprache | **TypeScript** durchgehend | Typisierung der Payload-Varianten, build-time Sicherheit |
| Build-Tool | **Vite** | SvelteKit-Standard |
| Package Manager | **pnpm** | Nutzerpräferenz; schnell, plattensparend, strikte Auflösung |
| QR-Library | **`qrcode`** (npm) | Bewährt, SVG-Output, ECC-Level konfigurierbar |
| PWA | **`@vite-pwa/sveltekit`** (Workbox) | Service Worker, Manifest, Offline-Precache |
| Test (Unit) | **Vitest** + `@testing-library/svelte` | Vite-Integration, schnell |
| Test (E2E) | **Playwright** | Cross-Browser, Offline-Simulation |
| QR-Decoder im Test | **`jsqr`** | Round-Trip-Verifikation |
| Hosting | **Cloudflare Pages** | Schnelles CDN, gratis Tier, Static-Adapter-kompatibel |
| CI | **GitHub Actions** | Standard, gratis für public/private Repos |

**Keine externen Laufzeit-Abhängigkeiten:** keine CDNs, keine Google Fonts, keine Analytics, keine Tracker.

---

## 3. Projektstruktur

```
qr-generator/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte          # PWA-Shell, Theme, Update-Prompt
│   │   ├── +page.svelte            # Hauptansicht
│   │   ├── qr/+page.svelte         # Vollbild-QR (?data=…&label=…)
│   │   ├── wifi/+page.svelte       # WLAN-Eingabeformular
│   │   ├── tel/+page.svelte        # Telefon-Eingabe
│   │   └── contact/+page.svelte    # Kontakt (vCard) Eingabe
│   ├── lib/
│   │   ├── types.ts                # QrPayload, Preset, HistoryEntry
│   │   ├── qr.ts                   # SVG-Generierung mit ECC-H
│   │   ├── payload.ts              # Payload → QR-Text-String
│   │   ├── presets.ts              # Validierung + Zugriff auf Presets
│   │   ├── history.ts              # LocalStorage-Wrapper mit Memory-Fallback
│   │   └── components/
│   │       ├── PresetGrid.svelte
│   │       ├── UrlInput.svelte
│   │       ├── QrDisplay.svelte
│   │       └── HistoryList.svelte
│   ├── data/
│   │   └── presets.json            # Versioniert im Repo
│   └── app.html
├── static/
│   ├── manifest.webmanifest
│   └── icons/                       # 192, 512, maskable
├── tests/
│   ├── unit/                        # Vitest
│   └── e2e/                         # Playwright
├── docs/
│   ├── manual-test.md               # Manuelle Test-Checkliste
│   └── superpowers/specs/           # Dieses Dokument
├── .github/workflows/ci.yml
├── pnpm-lock.yaml
├── package.json
├── svelte.config.js
├── vite.config.ts
└── tsconfig.json
```

---

## 4. Screens & UX

### Screen 1: Hauptansicht (`/`)

- **Preset-Grid** (2 Spalten, große Buttons, Label + Icon/Emoji), aus `presets.json`.
- **URL-Input** mit Live-QR-Generierung (debounced) und „Aus Zwischenablage einfügen"-Button.
- **Sekundäre Buttons** für `WLAN`, `Telefon`, `Kontakt` (eigene Sub-Routen).
- **Verlauf** (letzte 5 Einträge), Tap → direkt QR-Vollbild.
- **Offline-Indikator** im Header (🟢/🔴, rein informativ).

### Screen 2: QR-Vollbild (`/qr?data=…&label=…&kind=…`)

- QR füllt min. 80 % der Display-Breite, **schwarz auf weiß**, ECC-Level H, Quiet Zone ≥ 4 Module.
- Label oben, URL/Payload-Text unten (Truncate mit Tap-zum-Expandieren).
- **Tap auf QR** → echter Fullscreen-Modus (Fullscreen-API, CSS-Fallback).
- **Long-Press auf QR** → Invertieren (weiß auf schwarz) für ungünstige Lichtverhältnisse.
- Aktionen: `[Vollbild]`, `[Teilen]` (Web Share API), `[PNG]` (Download).
- Hinweis im Vollbild: „Helligkeit auf Maximum für besseres Scannen".

### Screen 3: WLAN-Form (`/wifi`)

- Felder: SSID, Passwort, Verschlüsselung (WPA/keine), Versteckt (Checkbox).
- Validierung: SSID nicht leer.
- Submit → Route zu `/qr` mit kodiertem WIFI-Payload.

Analog: `/tel` (eine Nummer) und `/contact` (Name + optional Tel/E-Mail/Org → vCard).

### UX-Prinzipien

- **1 Tap zum QR** für Presets (kritischster Pfad).
- **2 Taps zum QR** für URL aus Clipboard.
- Touch-Targets min. 56×56 px.
- Großzügiger Weißraum, hoher Kontrast (`prefers-color-scheme` agnostisch — wir setzen Kontrast aktiv).
- Eigene Routen statt Modals → Browser-Zurück funktioniert.

---

## 5. Datenmodell

### TypeScript-Typen (`src/lib/types.ts`)

```ts
export type QrPayload =
  | { kind: 'url';   value: string }
  | { kind: 'wifi';  value: { ssid: string; password: string; encryption: 'WPA' | 'WEP' | 'nopass'; hidden?: boolean } }
  | { kind: 'tel';   value: string }
  | { kind: 'vcard'; value: { name: string; tel?: string; email?: string; org?: string } }
  | { kind: 'text';  value: string };

export interface Preset {
  id: string;
  label: string;
  icon?: string;
  kind: QrPayload['kind'];
  value: QrPayload['value'];
}

export interface HistoryEntry {
  id: string;          // crypto.randomUUID() oder Fallback
  label: string;
  payload: QrPayload;
  createdAt: number;   // Date.now()
}
```

### `presets.json`

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

- Import zur Build-Zeit (`import presets from '$lib/../data/presets.json'`), kein Runtime-Fetch.
- Validierung beim Build (handgeschriebener Validator in `presets.ts`, geprüft im Build-Hook).

### Verlauf (LocalStorage)

- Key: `qr-generator:history:v1`
- Wert: `HistoryEntry[]`, neueste zuerst, max. **20 Einträge** (FIFO).
- Geschrieben nur bei erfolgreicher QR-Generierung.
- Lesen mit Schema-Validierung; bei Mismatch → leeren (kein Crash).
- Fallback bei LocalStorage-Verweigerung: In-Memory-Array.

### Payload → QR-Text-Encoding

| `kind` | QR-Text |
|---|---|
| `url` | `<value>` |
| `wifi` | `WIFI:T:<enc>;S:<ssid-escaped>;P:<pw-escaped>;H:<true/false>;;` |
| `tel` | `tel:<number>` |
| `vcard` | `BEGIN:VCARD\nVERSION:3.0\nFN:<name>\nTEL:<tel>\nEMAIL:<email>\nORG:<org>\nEND:VCARD` |
| `text` | `<value>` |

WIFI-Escape: `\`, `;`, `,`, `"`, `:` müssen mit `\` escaped werden.
`payload.ts` exportiert eine reine Funktion `payloadToQrString(p: QrPayload): string` — vollständig DOM-frei testbar.

---

## 6. PWA / Offline-Strategie

### Service Worker

- Strategie: **Precache only** via `@vite-pwa/sveltekit` (Workbox `injectManifest` oder `generateSW`).
- Precached: HTML, JS, CSS, Manifest, Icons.
- Kein Runtime-Caching nötig (alles im Bundle, keine externen Calls).
- Kein Background-Sync, kein Push, kein Periodic-Sync.

### Update-Verhalten

- `registerType: 'prompt'` — neue Version wird im Hintergrund geladen, aber **erst nach User-Bestätigung aktiviert**.
- UI: dezenter Badge im Header „Update verfügbar — anwenden?".
- Begründung: Niemals einen Reload mitten im Einsatz triggern.

### Manifest

```json
{
  "name": "QR-Generator",
  "short_name": "QR",
  "start_url": "/",
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

### Install-Hinweis

Einmaliger, dismissbarer Hinweis „Auf Startbildschirm hinzufügen für Offline-Nutzung". Kein aggressiver `beforeinstallprompt`-Auto-Prompt.

---

## 7. Fehlerfälle & Edge Cases

| Szenario | Verhalten |
|---|---|
| URL leer / ungültig | Generieren disabled, sanfter Hint, keine Pop-ups |
| URL > 2.953 Zeichen | Inline-Warnung, Generieren blockiert |
| `navigator.clipboard.readText` verweigert | Paste-Button fängt ab, Hint + Fokus ins Input |
| `presets.json` kaputt | Build crasht (Build-Time-Validierung) |
| LocalStorage voll/verweigert | In-Memory-Verlauf, kein User-Error |
| LocalStorage-Schema veraltet | Verworfen, kein Crash |
| Fullscreen-API verweigert | CSS-Pseudo-Fullscreen (fixed, inset-0, z-index hoch) |
| Web Share API fehlt | Teilen-Button versteckt, Download bleibt |
| `crypto.randomUUID` fehlt | Fallback: `Date.now() + Math.random().toString(36)` |
| Service Worker scheitert | App läuft normal (nur ohne Offline) |
| Update + offener QR | Badge erscheint, kein Auto-Reload |
| Lange URL im Vollbild | Truncate mit Tap-zum-Expandieren |
| WLAN-Passwort mit Sonderzeichen | Korrektes Escape gemäß WIFI-Spec |

### Display-Robustheit

- QR **immer** rein schwarz auf rein weiß.
- ECC-Level **H** (30 % Verlust-tolerant).
- Quiet Zone min. 4 Module.
- Long-Press invertiert für Reflexionen / Spiegelungen.

---

## 8. Tests

### Unit (Vitest)

- `payload.ts` — alle `kind`-Varianten, WIFI-Escape, vCard-Format, tel-Schema.
- `history.ts` — Schreiben/Lesen, FIFO-Cap (20), Schema-Mismatch, LocalStorage-Verweigerung.
- `presets.ts` — Validierung, Lookup, fehlerhafte Inputs.
- `qr.ts` — SVG-Struktur, ECC-Level korrekt gesetzt.

### Komponenten (Vitest + `@testing-library/svelte`)

- `UrlInput` — Disable-Zustand, Hints, Paste-Fehler.
- `PresetGrid` — Tap → korrekte Navigation mit Query-Params.
- `QrDisplay` — SVG-Rendering, Fullscreen-Fallback, Long-Press-Invert.

### E2E (Playwright)

- Happy Path Preset.
- Happy Path URL mit Live-Update.
- WLAN-Flow inkl. Decode-Verifikation.
- **Offline-Test:** Erste Seite laden → `context.setOffline(true)` → Reload → alle Flows funktionieren.
- Verlauf füllt sich, Tap → korrekter QR.
- PWA-Manifest erreichbar mit erwarteten Feldern.

### Round-Trip-Verifikation

Mittels `jsqr` decodiert eine Test-Helper-Funktion generierte SVGs zurück und vergleicht mit Original-Payload.

### CI-Pipeline (GitHub Actions, `.github/workflows/ci.yml`)

1. `pnpm/action-setup` (pin Version aus `package.json` `packageManager`).
2. `pnpm install --frozen-lockfile`.
3. `pnpm typecheck` (`svelte-check` + `tsc --noEmit`).
4. `pnpm lint` (ESLint + Prettier `--check`).
5. `pnpm test` (Vitest).
6. `pnpm test:e2e` (Playwright; Browser cached).
7. `pnpm build` (Vite — crasht bei `presets.json`-Validation-Fehler).
8. Cloudflare-Pages-Preview-Deploy pro PR.

### Manuelle Test-Checkliste (`docs/manual-test.md`)

- [ ] Auf Smartphone als PWA installiert?
- [ ] Drei Presets scannbar mit zweitem Smartphone aus 50 cm?
- [ ] Drei Presets scannbar aus 1,5 m (Vollbild)?
- [ ] Funktioniert nach Flugmodus-Toggle?
- [ ] WLAN-QR verbindet zweites Gerät tatsächlich?

---

## 9. Out of Scope (für v1)

- Benutzerdefinierte Presets im UI (kommt evtl. später).
- Mehrere Sprachen / i18n.
- Logo im QR-Code-Zentrum.
- Statistiken / Analytics.
- Multi-User / Synchronisation zwischen Geräten.
- Native iOS-/Android-App.

---

## 10. Erfolgs-Kriterien

- Drei Taps vom Home-Screen zum scannbaren Vollbild-QR.
- Bundle < 100 KB gzip nach Build.
- Funktioniert vollständig offline nach erstem Laden.
- Manuelle Test-Checkliste vollständig grün auf einem realen Gerät.
- Generierte QRs lassen sich von Standard-Smartphone-Kameras (iOS Safari, Android Chrome) aus 1,5 m Entfernung im Vollbild zuverlässig scannen.
