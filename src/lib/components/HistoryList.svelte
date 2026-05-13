<script lang="ts">
  import type { HistoryEntry, QrKind } from '$lib/types';

  interface Props {
    entries: HistoryEntry[];
    onSelect: (e: HistoryEntry) => void;
    limit?: number;
  }
  let { entries, onSelect, limit = 10 }: Props = $props();
  let shown = $derived(entries.slice(0, limit));

  const ICON: Record<QrKind, string> = {
    url: '🔗',
    wifi: '📶',
    tel: '📞',
    vcard: '👤',
    text: '📝'
  };

  function relativeTime(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'gerade eben';
    const mins = Math.round(diff / 60_000);
    if (mins < 60) return `vor ${mins} Min`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `vor ${hours} Std`;
    const days = Math.round(hours / 24);
    return `vor ${days} Tg`;
  }
</script>

{#if shown.length > 0}
  <section class="block" aria-label="Verlauf">
    <details>
      <summary>
        <span class="title">Verlauf</span>
        <span class="count">({shown.length})</span>
      </summary>
      <ul class="list">
        {#each shown as e (e.id)}
          <li>
            <button type="button" class="entry" onclick={() => onSelect(e)}>
              <span class="kind" aria-hidden="true">{ICON[e.payload.kind] ?? '•'}</span>
              <span class="label">{e.label}</span>
              <span class="when">{relativeTime(e.createdAt)}</span>
            </button>
          </li>
        {/each}
      </ul>
    </details>
  </section>
{/if}

<style>
  .block {
    margin-top: var(--space-5);
  }

  details {
    border: var(--border-med) solid var(--ink);
    border-radius: var(--radius);
    background: var(--paper);
  }

  summary {
    list-style: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: var(--text-sm);
    min-height: var(--tap);
    user-select: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary::after {
    content: '+';
    margin-left: auto;
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1;
  }

  details[open] > summary::after {
    content: '−';
  }

  .count {
    color: var(--ink-muted);
    font-weight: 700;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: var(--border-med) solid var(--ink);
    max-height: 360px;
    overflow-y: auto;
  }

  .list li + li {
    border-top: 1px solid var(--ink);
  }

  .entry {
    width: 100%;
    background: transparent;
    color: var(--ink);
    border: none;
    border-radius: 0;
    justify-content: flex-start;
    text-align: left;
    padding: var(--space-2) var(--space-3);
    gap: var(--space-3);
    min-height: var(--tap);
    font-weight: 600;
  }

  .entry:hover:not(:disabled) {
    background: var(--surface-2);
    color: var(--ink);
  }

  .entry:focus-visible {
    outline-offset: -4px;
  }

  .kind {
    font-size: 1.25rem;
    line-height: 1;
    flex: 0 0 auto;
  }
  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .when {
    flex: 0 0 auto;
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
</style>
