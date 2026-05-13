export function requireDb(platform: App.Platform | undefined): D1Database {
  if (!platform?.env?.DB) {
    throw new Error('D1 binding "DB" is not available. Run via wrangler/pnpm dev.');
  }
  return platform.env.DB;
}

export function requireEnv<K extends keyof App.Platform['env']>(
  platform: App.Platform | undefined,
  key: K
): App.Platform['env'][K] {
  const v = platform?.env?.[key];
  if (v === undefined || v === null || v === '') {
    throw new Error(`Missing env: ${String(key)}`);
  }
  return v;
}
