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
