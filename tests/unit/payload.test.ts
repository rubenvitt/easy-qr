import { describe, it, expect } from 'vitest';
import { payloadToQrString } from '../../src/lib/payload';

describe('payloadToQrString — url', () => {
  it('returns the URL value as-is', () => {
    expect(payloadToQrString({ kind: 'url', value: 'https://example.org/x' })).toBe(
      'https://example.org/x'
    );
  });
});
