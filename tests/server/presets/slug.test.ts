import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '../../helpers/fake-d1';
import { slugify, uniqueSlug } from '../../../src/lib/server/presets/slug';

describe('slugify', () => {
  it('lowercases', () => expect(slugify('Hello World')).toBe('hello-world'));
  it('collapses special chars', () => expect(slugify('Beispiel — Link!')).toBe('beispiel-link'));
  it('transliterates umlauts', () =>
    expect(slugify('Übung WLAN für Süß')).toBe('uebung-wlan-fuer-suess'));
  it('falls back to "preset"', () => expect(slugify(' ')).toBe('preset'));
  it('truncates to 60', () => expect(slugify('a'.repeat(120)).length).toBe(60));
});

describe('uniqueSlug', () => {
  let db: D1Database;
  beforeEach(() => (db = createFakeD1().db));

  it('returns base when free', async () => {
    expect(await uniqueSlug(db, 'foo')).toBe('foo');
  });

  it('appends -2 on first collision', async () => {
    await db
      .prepare(
        `INSERT INTO presets (id,label,kind,value,sort_order,created_at,updated_at,created_by,updated_by)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .bind('foo', 'Foo', 'text', '""', 0, 0, 0, 'x', 'x')
      .run();
    expect(await uniqueSlug(db, 'foo')).toBe('foo-2');
  });

  it('walks until free', async () => {
    for (const id of ['bar', 'bar-2', 'bar-3']) {
      await db
        .prepare(
          `INSERT INTO presets (id,label,kind,value,sort_order,created_at,updated_at,created_by,updated_by)
           VALUES (?,?,?,?,?,?,?,?,?)`
        )
        .bind(id, id, 'text', '""', 0, 0, 0, 'x', 'x')
        .run();
    }
    expect(await uniqueSlug(db, 'bar')).toBe('bar-4');
  });
});
