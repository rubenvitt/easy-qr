import { describe, it, expect } from 'vitest';
import { validatePresetInput } from '../../../src/lib/server/presets/validator';

describe('validatePresetInput', () => {
  it('accepts minimal url', () => {
    expect(validatePresetInput({ label: 'X', kind: 'url', value: 'https://x' }).ok).toBe(true);
  });
  it('rejects empty label', () => {
    expect(validatePresetInput({ label: '', kind: 'url', value: 'x' }).ok).toBe(false);
  });
  it('rejects label > 80', () => {
    expect(validatePresetInput({ label: 'a'.repeat(81), kind: 'url', value: 'x' }).ok).toBe(false);
  });
  it('rejects unknown kind', () => {
    expect(validatePresetInput({ label: 'X', kind: 'pikachu', value: 'x' }).ok).toBe(false);
  });
  it('rejects wifi without ssid', () => {
    expect(validatePresetInput({ label: 'X', kind: 'wifi', value: { encryption: 'WPA' } }).ok).toBe(
      false
    );
  });
  it('accepts wifi with ssid', () => {
    expect(
      validatePresetInput({
        label: 'X',
        kind: 'wifi',
        value: { ssid: 'Net', password: 'p', encryption: 'WPA' }
      }).ok
    ).toBe(true);
  });
  it('rejects vcard without name', () => {
    expect(validatePresetInput({ label: 'X', kind: 'vcard', value: { tel: '+49' } }).ok).toBe(
      false
    );
  });
  it('rejects malformed slug id', () => {
    expect(validatePresetInput({ id: 'Foo Bar', label: 'X', kind: 'text', value: 'hi' }).ok).toBe(
      false
    );
  });
  it('accepts slug id', () => {
    expect(validatePresetInput({ id: 'foo-bar', label: 'X', kind: 'text', value: 'hi' }).ok).toBe(
      true
    );
  });
  it('rejects unknown wifi encryption', () => {
    expect(
      validatePresetInput({
        label: 'X',
        kind: 'wifi',
        value: { ssid: 'N', encryption: 'WPA3' }
      }).ok
    ).toBe(false);
  });
});
