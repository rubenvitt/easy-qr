import { describe, it, expect } from 'vitest';
import { validatePresetsFile } from '../../src/lib/presets';

describe('validatePresetsFile', () => {
  it('accepts a well-formed file', () => {
    expect(() =>
      validatePresetsFile({
        version: 1,
        presets: [{ id: 'a', label: 'A', kind: 'url', value: 'https://x' }]
      })
    ).not.toThrow();
  });

  it('accepts an empty presets array', () => {
    expect(() => validatePresetsFile({ version: 1, presets: [] })).not.toThrow();
  });

  it('rejects non-object input', () => {
    expect(() => validatePresetsFile(null)).toThrow();
    expect(() => validatePresetsFile('nope')).toThrow();
  });

  it('rejects missing version', () => {
    expect(() => validatePresetsFile({ presets: [] })).toThrow();
  });

  it('rejects unsupported version', () => {
    expect(() => validatePresetsFile({ version: 2, presets: [] })).toThrow();
  });

  it('rejects when presets is not an array', () => {
    expect(() => validatePresetsFile({ version: 1, presets: {} })).toThrow();
  });
});
