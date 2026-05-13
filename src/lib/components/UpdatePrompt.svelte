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
  <div class="prompt" role="status" aria-live="polite">
    <div class="msg">
      <strong>Update verfügbar</strong>
      <span class="sub">Neue Version wartet auf Neustart.</span>
    </div>
    <div class="actions">
      <button type="button" class="primary apply" onclick={applyUpdate}>Jetzt neustarten</button>
      <button type="button" class="dismiss" aria-label="Später" onclick={dismiss}>Später</button>
    </div>
  </div>
{/if}

<style>
  .prompt {
    position: fixed;
    left: var(--space-3);
    right: var(--space-3);
    bottom: var(--space-3);
    z-index: 100;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3);
    background: var(--ink);
    color: var(--paper);
    border: var(--border-thick) solid var(--ink);
    border-radius: var(--radius);
    animation: slide-up 0.2s ease-out;
  }
  @keyframes slide-up {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  .msg {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1 1 200px;
    min-width: 0;
  }
  .msg strong {
    font-size: var(--text-base);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .sub {
    font-size: var(--text-sm);
    color: var(--paper);
    opacity: 0.75;
  }
  .actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .apply {
    min-height: 48px;
    font-size: var(--text-base);
  }
  .dismiss {
    min-height: 48px;
    background: transparent;
    color: var(--paper);
    border-color: var(--paper);
  }
  .dismiss:hover:not(:disabled) {
    background: var(--paper);
    color: var(--ink);
  }
</style>
