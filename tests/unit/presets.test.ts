import { describe, it, expect } from 'vitest';
import { validatePresetsFile, getPreset, allPresets } from '../../src/lib/presets';

describe('validatePresetsFile', () => {
  it('accepts a well-formed file', () => {
    expect(() =>
      validatePresetsFile({
        version: 1,
        presets: [{ id: 'a', label: 'A', kind: 'url', value: 'https://x' }]
      })
    ).not.toThrow();
  });

  it('rejects missing version', () => {
    expect(() => validatePresetsFile({ presets: [] })).toThrow();
  });

  it('rejects unsupported kind', () => {
    expect(() =>
      validatePresetsFile({
        version: 1,
        presets: [{ id: 'a', label: 'A', kind: 'bogus', value: 'x' }]
      })
    ).toThrow();
  });

  it('rejects duplicate ids', () => {
    expect(() =>
      validatePresetsFile({
        version: 1,
        presets: [
          { id: 'a', label: 'A', kind: 'url', value: 'https://x' },
          { id: 'a', label: 'B', kind: 'url', value: 'https://y' }
        ]
      })
    ).toThrow();
  });

  it('rejects wifi without ssid', () => {
    expect(() =>
      validatePresetsFile({
        version: 1,
        presets: [
          {
            id: 'w',
            label: 'W',
            kind: 'wifi',
            value: { ssid: '', password: '', encryption: 'WPA' }
          }
        ]
      })
    ).toThrow();
  });

  it('rejects vcard without name', () => {
    expect(() =>
      validatePresetsFile({
        version: 1,
        presets: [{ id: 'v', label: 'V', kind: 'vcard', value: { tel: '123' } }]
      })
    ).toThrow();
  });
});

describe('allPresets / getPreset', () => {
  it('returns the bundled presets', () => {
    const list = allPresets();
    expect(list.length).toBeGreaterThan(0);
  });

  it('finds preset by id', () => {
    expect(getPreset('lage-aktuell')?.label).toBe('Lage aktuell');
  });

  it('returns undefined for unknown id', () => {
    expect(getPreset('nope')).toBeUndefined();
  });
});
