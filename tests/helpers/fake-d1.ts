import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
}

function splitSql(sql: string): string[] {
  return sql
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createFakeD1(): { db: D1Database; raw: Database.Database } {
  const sqlite = new Database(':memory:');
  const dir = join(process.cwd(), 'migrations');
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.sql')) continue;
    const raw = readFileSync(join(dir, file), 'utf8');
    for (const stmt of splitSql(raw)) sqlite.prepare(stmt).run();
  }
  const db: D1Database = {
    prepare(sql: string): D1PreparedStatement {
      const stmt = sqlite.prepare(sql);
      const params: unknown[] = [];
      const api: D1PreparedStatement = {
        bind(...values) {
          params.push(...values);
          return api;
        },
        async first<T = unknown>() {
          return (stmt.get(...(params as unknown[])) ?? null) as T | null;
        },
        async all<T = unknown>() {
          return { results: stmt.all(...(params as unknown[])) as T[] };
        },
        async run() {
          const info = stmt.run(...(params as unknown[]));
          return { success: true, meta: { changes: info.changes } };
        }
      };
      return api;
    },
    async batch(stmts: D1PreparedStatement[]) {
      const out: Array<{ success: boolean; meta?: { changes?: number } }> = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    }
  } as unknown as D1Database;
  return { db, raw: sqlite };
}
