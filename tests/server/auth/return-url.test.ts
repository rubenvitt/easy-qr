import { describe, it, expect } from 'vitest';
import { sanitizeReturnUrl } from '../../../src/lib/server/auth/return-url';

describe('sanitizeReturnUrl', () => {
  it('accepts internal path', () => expect(sanitizeReturnUrl('/admin')).toBe('/admin'));
  it('accepts root', () => expect(sanitizeReturnUrl('/')).toBe('/'));
  it('rejects protocol-relative', () => expect(sanitizeReturnUrl('//evil.com')).toBe('/'));
  it('rejects absolute external', () => expect(sanitizeReturnUrl('https://evil.com/x')).toBe('/'));
  it('rejects null', () => expect(sanitizeReturnUrl(null)).toBe('/'));
  it('rejects header injection', () =>
    expect(sanitizeReturnUrl('/admin\nset-cookie: x')).toBe('/'));
});
