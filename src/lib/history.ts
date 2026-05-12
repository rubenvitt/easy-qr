import type { HistoryEntry, QrPayload } from './types';

export const HISTORY_KEY = 'qr-generator:history:v1';
export const HISTORY_LIMIT = 20;

let memoryFallback: HistoryEntry[] = [];
let useFallback = false;

function safeGet(): string | null {
  if (useFallback) return null;
  try {
    return localStorage.getItem(HISTORY_KEY);
  } catch {
    useFallback = true;
    return null;
  }
}

function safeSet(value: string): void {
  if (useFallback) return;
  try {
    localStorage.setItem(HISTORY_KEY, value);
  } catch {
    useFallback = true;
  }
}

const VALID_KINDS: ReadonlyArray<QrPayload['kind']> = ['url', 'wifi', 'tel', 'vcard', 'text'];

function isValidEntry(e: unknown): e is HistoryEntry {
  if (typeof e !== 'object' || e === null) return false;
  const r = e as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.label !== 'string' || typeof r.createdAt !== 'number')
    return false;
  if (typeof r.payload !== 'object' || r.payload === null) return false;
  const p = r.payload as Record<string, unknown>;
  return typeof p.kind === 'string' && VALID_KINDS.includes(p.kind as QrPayload['kind']);
}

export function loadHistory(): HistoryEntry[] {
  if (useFallback) return [...memoryFallback];
  const raw = safeGet();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
}

export function addEntry(entry: HistoryEntry): void {
  const list = useFallback ? memoryFallback : loadHistory();
  const next = [entry, ...list].slice(0, HISTORY_LIMIT);
  if (useFallback) {
    memoryFallback = next;
    return;
  }
  safeSet(JSON.stringify(next));
  if (useFallback) memoryFallback = next;
}

export function clearHistory(): void {
  memoryFallback = [];
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}
