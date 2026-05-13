import { describe, it, expect } from 'vitest';
import { createFakeD1 } from './fake-d1';

describe('fake-d1', () => {
  it('runs migrations and seeds demo-url', async () => {
    const { db } = createFakeD1();
    const row = await db
      .prepare(`SELECT id FROM presets WHERE id = ?`)
      .bind('demo-url')
      .first<{ id: string }>();
    expect(row?.id).toBe('demo-url');
  });
});
