import { describe, it, expect } from 'vitest';
import { payloadToQrString } from '../../src/lib/payload';

describe('payloadToQrString — url', () => {
  it('returns the URL value as-is', () => {
    expect(payloadToQrString({ kind: 'url', value: 'https://example.org/x' })).toBe(
      'https://example.org/x'
    );
  });
});

describe('payloadToQrString — tel', () => {
  it('prefixes tel: scheme', () => {
    expect(payloadToQrString({ kind: 'tel', value: '+4915112345678' })).toBe(
      'tel:+4915112345678'
    );
  });
});

describe('payloadToQrString — text', () => {
  it('returns text value as-is', () => {
    expect(payloadToQrString({ kind: 'text', value: 'Hallo Welt' })).toBe('Hallo Welt');
  });
});

describe('payloadToQrString — wifi', () => {
  it('encodes WPA SSID and password', () => {
    expect(
      payloadToQrString({
        kind: 'wifi',
        value: { ssid: 'DRK-Gast', password: 'geheim', encryption: 'WPA' }
      })
    ).toBe('WIFI:T:WPA;S:DRK-Gast;P:geheim;H:false;;');
  });

  it('encodes nopass network', () => {
    expect(
      payloadToQrString({
        kind: 'wifi',
        value: { ssid: 'Open', password: '', encryption: 'nopass' }
      })
    ).toBe('WIFI:T:nopass;S:Open;P:;H:false;;');
  });

  it('encodes hidden flag', () => {
    expect(
      payloadToQrString({
        kind: 'wifi',
        value: { ssid: 'Stealth', password: 'x', encryption: 'WPA', hidden: true }
      })
    ).toBe('WIFI:T:WPA;S:Stealth;P:x;H:true;;');
  });

  it('escapes reserved characters in ssid and password', () => {
    expect(
      payloadToQrString({
        kind: 'wifi',
        value: { ssid: 'A;B,C:D"E\\F', password: 'p;a"b\\', encryption: 'WPA' }
      })
    ).toBe('WIFI:T:WPA;S:A\\;B\\,C\\:D\\"E\\\\F;P:p\\;a\\"b\\\\;H:false;;');
  });
});

describe('payloadToQrString — vcard', () => {
  it('encodes minimal vCard (name only)', () => {
    expect(payloadToQrString({ kind: 'vcard', value: { name: 'Max Mustermann' } })).toBe(
      'BEGIN:VCARD\nVERSION:3.0\nFN:Max Mustermann\nEND:VCARD'
    );
  });

  it('includes optional fields when present', () => {
    expect(
      payloadToQrString({
        kind: 'vcard',
        value: {
          name: 'Erika',
          tel: '+491701234567',
          email: 'erika@drk.de',
          org: 'DRK Kreisverband'
        }
      })
    ).toBe(
      'BEGIN:VCARD\nVERSION:3.0\nFN:Erika\nTEL:+491701234567\nEMAIL:erika@drk.de\nORG:DRK Kreisverband\nEND:VCARD'
    );
  });

  it('skips missing optional fields entirely', () => {
    expect(
      payloadToQrString({ kind: 'vcard', value: { name: 'A', email: 'a@b' } })
    ).toBe('BEGIN:VCARD\nVERSION:3.0\nFN:A\nEMAIL:a@b\nEND:VCARD');
  });
});
