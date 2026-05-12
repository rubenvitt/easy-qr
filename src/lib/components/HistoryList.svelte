<script lang="ts">
  import type { HistoryEntry } from '$lib/types';

  interface Props {
    entries: HistoryEntry[];
    onSelect: (e: HistoryEntry) => void;
    limit?: number;
  }
  let { entries, onSelect, limit = 5 }: Props = $props();
  let shown = $derived(entries.slice(0, limit));
</script>

{#if shown.length > 0}
  <section aria-label="Verlauf">
    <h2>Verlauf</h2>
    <ul>
      {#each shown as e (e.id)}
        <li>
          <button type="button" class="secondary" onclick={() => onSelect(e)}>
            {e.label}
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }
  li button {
    width: 100%;
    justify-content: flex-start;
  }
  h2 {
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
</style>
