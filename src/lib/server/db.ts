import Database from 'better-sqlite3';
import { readdirSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';

let dbInstance: Database.Database | null = null;

function resolveDbPath(): string {
  const raw = process.env.DB_PATH;
  if (!raw || raw.length === 0) return './data/app.db';
  if (raw === ':memory:') return raw;
  return isAbsolute(raw) ? raw : join(process.cwd(), raw);
}

function resolveMigrationsDir(): string {
  const raw = process.env.MIGRATIONS_DIR;
  if (raw && raw.length > 0) {
    return isAbsolute(raw) ? raw : join(process.cwd(), raw);
  }
  return join(process.cwd(), 'migrations');
}

function applyMigrations(db: Database.Database, dir: string): void {
  if (!existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`);
  }
  const ddl = `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`;
  db.exec(ddl);
  const applied = new Set(
    (db.prepare(`SELECT name FROM _migrations`).all() as { name: string }[]).map((r) => r.name)
  );
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), 'utf8');
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare(`INSERT INTO _migrations (name, applied_at) VALUES (?, ?)`).run(file, Date.now());
    });
    tx();
  }
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;
  const path = resolveDbPath();
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  applyMigrations(db, resolveMigrationsDir());
  dbInstance = db;
  return db;
}

export function setDbForTesting(db: Database.Database): void {
  dbInstance = db;
}

export function __resetDbForTesting(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      /* ignore */
    }
  }
  dbInstance = null;
}

export type Db = Database.Database;

export function getEnv(key: string): string {
  const v = process.env[key];
  if (v === undefined || v === null || v === '') {
    throw new Error(`Missing env: ${key}`);
  }
  return v;
}

export function optionalEnv(key: string): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}
