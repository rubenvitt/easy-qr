<!-- src/routes/qr/+page.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import QrDisplay from '$lib/components/QrDisplay.svelte';

  let data = $derived($page.url.searchParams.get('data') ?? '');
  let label = $derived($page.url.searchParams.get('label') ?? '');
  let kind = $derived($page.url.searchParams.get('kind') ?? '');
  let showRawData = $derived(kind !== 'wifi' && kind !== 'vcard');
  let inverted = $state(false);
  let nativeFullscreen = $state(false);
  let cssFullscreen = $state(false);
  let qrEl = $state<HTMLDivElement | null>(null);
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let pressFired = $state(false);

  onMount(() => {
    const onFs = () => {
      nativeFullscreen = !!document.fullscreenElement;
      if (nativeFullscreen) cssFullscreen = false;
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  });

  async function toggleFullscreen() {
    if (pressFired) {
      pressFired = false;
      return;
    }
    if (!qrEl) return;
    if (nativeFullscreen) {
      await document.exitFullscreen?.();
      return;
    }
    if (cssFullscreen) {
      cssFullscreen = false;
      return;
    }
    try {
      await qrEl.requestFullscreen?.();
    } catch {
      cssFullscreen = true;
    }
  }

  function onPressStart() {
    onPressEnd();
    pressFired = false;
    pressTimer = setTimeout(() => {
      inverted = !inverted;
      pressFired = true;
    }, 600);
  }

  function onPressEnd() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }

  async function share() {
    try {
      await navigator.share?.({ title: label || 'QR', text: data });
    } catch {
      // user dismissed
    }
  }

  function downloadPng() {
    const svg = qrEl?.querySelector('svg');
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }
      ctx.fillStyle = inverted ? '#000' : '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (inverted) {
        ctx.filter = 'invert(1)';
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';
      canvas.toBlob((png) => {
        if (!png) {
          URL.revokeObjectURL(url);
          return;
        }
        const pngUrl = URL.createObjectURL(png);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${label || 'qr'}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(pngUrl), 0);
      }, 'image/png');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  let canShare = $state(false);
  onMount(() => {
    canShare = typeof navigator.share === 'function';
  });
  onDestroy(() => onPressEnd());
</script>

<div class="screen" class:css-fullscreen={cssFullscreen}>
  <a class="button ghost back" href="/">← Zurück</a>

  {#if label}
    <h1>{label}</h1>
  {/if}

  <div
    class="qr-card"
    bind:this={qrEl}
    role="button"
    tabindex="0"
    aria-label="QR-Code — Tippen für Vollbild, lang drücken zum Invertieren"
    onclick={toggleFullscreen}
    onpointerdown={onPressStart}
    onpointerup={onPressEnd}
    onpointercancel={onPressEnd}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleFullscreen();
      }
    }}
  >
    <QrDisplay text={data} {inverted} />
  </div>

  <p class="hint">
    <strong>Helligkeit auf Maximum.</strong> Tippen für Vollbild, lang drücken zum Invertieren.
  </p>

  {#if showRawData}
    <p class="data">{data}</p>
  {/if}

  <div class="actions">
    <button type="button" class="secondary" onclick={toggleFullscreen}>
      <span aria-hidden="true">⛶</span> Vollbild
    </button>
    {#if canShare}
      <button type="button" class="secondary" onclick={share}>
        <span aria-hidden="true">↗</span> Teilen
      </button>
    {/if}
    <button type="button" class="secondary" onclick={downloadPng}>
      <span aria-hidden="true">⬇</span> PNG
    </button>
  </div>
</div>

<style>
  .screen {
    display: grid;
    gap: var(--space-3);
  }
  .back {
    justify-self: start;
    margin-bottom: var(--space-1);
  }
  h1 {
    font-size: var(--text-xl);
    text-align: center;
    margin: 0;
    font-weight: 800;
    word-break: break-word;
  }
  .qr-card {
    cursor: pointer;
    border-radius: var(--radius);
  }
  .qr-card:focus-visible {
    outline-offset: 4px;
  }
  .data {
    font-family: ui-monospace, monospace;
    font-size: var(--text-sm);
    word-break: break-all;
    text-align: center;
    color: var(--ink-muted);
    margin: 0;
    padding: var(--space-2) var(--space-3);
    background: var(--surface-2);
    border-radius: var(--radius-sm);
  }
  .hint {
    text-align: center;
    color: var(--ink-muted);
    font-size: var(--text-sm);
    margin: 0;
  }
  .actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .css-fullscreen {
    position: fixed;
    inset: 0;
    background: var(--paper);
    z-index: 9999;
    padding: var(--space-3);
    overflow: auto;
    display: grid;
    place-items: center;
    grid-template-rows: auto auto 1fr auto auto;
  }
</style>
