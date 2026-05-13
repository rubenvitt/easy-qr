<script lang="ts">
  import { payloadToSvg } from '$lib/qr';

  interface Props {
    text: string;
    inverted?: boolean;
  }
  let { text, inverted = false }: Props = $props();

  let svg = $state<string>('');
  let error = $state<string | null>(null);

  $effect(() => {
    if (!text) {
      svg = '';
      error = 'Eingabe leer';
      return;
    }
    error = null;
    let cancelled = false;
    payloadToSvg(text)
      .then((s) => {
        if (!cancelled) svg = s;
      })
      .catch((e: Error) => {
        if (!cancelled) error = e.message;
      });
    return () => {
      cancelled = true;
    };
  });
</script>

{#if error}
  <p class="placeholder">{error}</p>
{:else}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  <div class="qr" class:inverted aria-label="QR-Code">{@html svg}</div>
{/if}

<style>
  .qr {
    display: grid;
    place-items: center;
    background: #ffffff;
    padding: var(--space-4);
    border: var(--border-thick) solid #000000;
    border-radius: var(--radius);
  }
  .qr.inverted {
    background: #000000;
    border-color: #ffffff;
    filter: invert(1);
  }
  .qr :global(svg) {
    width: 100%;
    height: auto;
    max-width: 100%;
    display: block;
  }
  .placeholder {
    color: var(--ink-muted);
    text-align: center;
    padding: var(--space-5) var(--space-3);
    border: var(--border-med) dashed var(--ink);
    border-radius: var(--radius);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: var(--text-sm);
  }
</style>
