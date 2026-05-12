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
    if (r.kind === 'vcard') {
      const v = r.value as { name?: unknown } | undefined;
      if (!v || typeof v.name !== 'string' || !v.name)
        throw new Error(`presets: vcard entry "${r.id}" missing name`);
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
