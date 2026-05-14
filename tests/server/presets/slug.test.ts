import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../helpers/test-db';
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
  let db: ReturnType<typeof createTestDb>;
  beforeEach(() => {
    db = createTestDb();
  });

  it('returns base when free', () => {
    expect(uniqueSlug(db, 'foo')).toBe('foo');
  });

  it('appends -2 on first collision', () => {
    db.prepare(
      `INSERT INTO presets (id,label,kind,value,sort_order,created_at,updated_at,created_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run('foo', 'Foo', 'text', '""', 0, 0, 0, 'x', 'x');
    expect(uniqueSlug(db, 'foo')).toBe('foo-2');
  });

  it('walks until free', () => {
    for (const id of ['bar', 'bar-2', 'bar-3']) {
      db.prepare(
        `INSERT INTO presets (id,label,kind,value,sort_order,created_at,updated_at,created_by,updated_by)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).run(id, id, 'text', '""', 0, 0, 0, 'x', 'x');
    }
    expect(uniqueSlug(db, 'bar')).toBe('bar-4');
  });
});
