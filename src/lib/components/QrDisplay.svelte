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
    payloadToSvg(text)
      .then((s) => (svg = s))
      .catch((e: Error) => (error = e.message));
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
    background: #fff;
    padding: 1rem;
    border-radius: 8px;
  }
  .qr.inverted {
    background: #000;
    filter: invert(1);
  }
  .qr :global(svg) {
    width: 100%;
    height: auto;
    max-width: 100%;
  }
  .placeholder {
    color: var(--muted);
    text-align: center;
    padding: 2rem;
  }
</style>
