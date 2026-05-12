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
