import type { Preset } from './types';

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
