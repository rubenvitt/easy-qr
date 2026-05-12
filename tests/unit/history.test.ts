import { describe, it, expect, beforeEach } from 'vitest';
import { loadHistory, addEntry, HISTORY_KEY, HISTORY_LIMIT } from '../../src/lib/history';
import type { HistoryEntry } from '../../src/lib/types';

function entry(label: string, ts = Date.now()): HistoryEntry {
  return {
    id: `id-${label}`,
    label,
    payload: { kind: 'url', value: `https://example.org/${label}` },
    createdAt: ts
  };
}

describe('history (LocalStorage backed)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array when nothing stored', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('persists added entries newest first', () => {
    addEntry(entry('a', 1));
    addEntry(entry('b', 2));
    const list = loadHistory();
    expect(list.map((e) => e.label)).toEqual(['b', 'a']);
  });

  it('caps the list at HISTORY_LIMIT (FIFO)', () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      addEntry(entry(`e${i}`, i));
    }
    const list = loadHistory();
    expect(list.length).toBe(HISTORY_LIMIT);
    expect(list[0].label).toBe(`e${HISTORY_LIMIT + 4}`);
  });

  it('returns [] when stored value has invalid schema', () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([{ totally: 'wrong' }]));
    expect(loadHistory()).toEqual([]);
  });

  it('returns [] when stored value is not JSON', () => {
    localStorage.setItem(HISTORY_KEY, 'not-json');
    expect(loadHistory()).toEqual([]);
  });
});
