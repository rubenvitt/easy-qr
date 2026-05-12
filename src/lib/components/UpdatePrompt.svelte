<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte';

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        setInterval(
          () => {
            r.update();
          },
          60 * 60 * 1000
        );
      }
    }
  });

  let visible = $derived($needRefresh);

  function applyUpdate() {
    updateServiceWorker(true);
  }

  function dismiss() {
    needRefresh.set(false);
  }
</script>

{#if visible}
  <div class="prompt" role="status">
    <span>Update verfügbar</span>
    <button type="button" onclick={applyUpdate}>Anwenden</button>
    <button type="button" class="secondary" onclick={dismiss}>Später</button>
  </div>
{/if}

<style>
  .prompt {
    position: sticky;
    top: 0;
    background: var(--fg);
    color: var(--bg);
    padding: 0.75rem 1rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
    z-index: 100;
  }
  .prompt button {
    min-height: 40px;
    padding: 0.4rem 0.8rem;
    font-size: 0.95rem;
    background: var(--bg);
    color: var(--fg);
  }
  .prompt button.secondary {
    background: var(--fg);
    color: var(--bg);
    border-color: var(--bg);
  }
</style>
