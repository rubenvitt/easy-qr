<!-- src/routes/qr/+page.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import QrDisplay from '$lib/components/QrDisplay.svelte';

  let data = $derived($page.url.searchParams.get('data') ?? '');
  let label = $derived($page.url.searchParams.get('label') ?? '');
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
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = inverted ? '#000' : '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (inverted) {
        ctx.filter = 'invert(1)';
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';
      canvas.toBlob((png) => {
        if (!png) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(png);
        a.download = `${label || 'qr'}.png`;
        a.click();
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
  {#if label}
    <h1>{label}</h1>
  {/if}

  <div
    bind:this={qrEl}
    role="button"
    tabindex="0"
    onclick={toggleFullscreen}
    onpointerdown={onPressStart}
    onpointerup={onPressEnd}
    onpointercancel={onPressEnd}
    onkeydown={(e) => e.key === 'Enter' && toggleFullscreen()}
  >
    <QrDisplay text={data} {inverted} />
  </div>

  <p class="data">{data}</p>
  <p class="hint">Helligkeit auf Maximum für besseres Scannen.</p>

  <div class="actions">
    <button type="button" class="secondary" onclick={toggleFullscreen}>⛶ Vollbild</button>
    {#if canShare}
      <button type="button" class="secondary" onclick={share}>↗ Teilen</button>
    {/if}
    <button type="button" class="secondary" onclick={downloadPng}>⬇ PNG</button>
    <a class="button secondary" href="/">← Zurück</a>
  </div>
</div>

<style>
  .screen {
    display: grid;
    gap: 1rem;
  }
  h1 {
    font-size: 1.5rem;
    text-align: center;
    margin: 0;
  }
  .data {
    font-family: ui-monospace, monospace;
    word-break: break-all;
    text-align: center;
    color: var(--muted);
  }
  .hint {
    text-align: center;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .actions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  .css-fullscreen {
    position: fixed;
    inset: 0;
    background: #fff;
    z-index: 9999;
    padding: 1rem;
    overflow: auto;
  }
</style>
