const UMLAUT_MAP: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

export function slugify(input: string): string {
  const lower = input.toLowerCase();
  const transliterated = lower.replace(/[äöüß]/g, (c) => UMLAUT_MAP[c] ?? c);
  const slug = transliterated
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'preset';
}

export async function uniqueSlug(db: D1Database, base: string): Promise<string> {
  let candidate = base;
  let suffix = 2;
  while (true) {
    const row = await db
      .prepare(`SELECT 1 AS one FROM presets WHERE id = ?`)
      .bind(candidate)
      .first<{ one: number }>();
    if (!row) return candidate;
    candidate = `${base}-${suffix++}`;
    if (suffix > 1000) throw new Error('uniqueSlug: exhausted suffix space');
  }
}
