export function sanitizeReturnUrl(raw: string | null): string {
  if (!raw) return '/';
  if (raw.startsWith('//')) return '/';
  if (raw.includes('\n') || raw.includes('\r')) return '/';
  if (!raw.startsWith('/')) return '/';
  return raw;
}
