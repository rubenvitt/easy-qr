import { describe, it, expect, vi, afterEach } from 'vitest';
import { randomId } from '../../src/lib/uuid';

describe('randomId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'aaaa-bbbb-cccc' });
    expect(randomId()).toBe('aaaa-bbbb-cccc');
  });

  it('falls back to Date.now() + Math.random() when randomUUID missing', () => {
    vi.stubGlobal('crypto', {});
    const id = randomId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(8);
  });
});
