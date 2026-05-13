<script lang="ts">
  import { onMount } from 'svelte';

  let online = $state(true);

  onMount(() => {
    online = navigator.onLine;
    const on = () => (online = true);
    const off = () => (online = false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  });
</script>

{#if !online}
  <span class="badge" role="status" aria-label="Offline">
    <span class="dot" aria-hidden="true"></span>
    OFFLINE
  </span>
{/if}

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    background: var(--accent);
    color: var(--accent-ink);
    border: var(--border-med) solid var(--ink);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    line-height: 1;
  }
  .dot {
    width: 8px;
    height: 8px;
    background: var(--ink);
    border-radius: 50%;
  }
</style>
