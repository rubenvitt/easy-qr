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

<span class="dot" class:offline={!online} aria-label={online ? 'Online' : 'Offline'}>
  {online ? '🟢' : '🔴'} {online ? 'Online' : 'Offline'}
</span>

<style>
  .dot {
    font-size: 0.9rem;
    color: var(--muted);
  }
  .offline {
    color: var(--fg);
    font-weight: 600;
  }
</style>
