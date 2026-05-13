<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import PresetGrid from '$lib/components/PresetGrid.svelte';
  import UrlInput from '$lib/components/UrlInput.svelte';
  import HistoryList from '$lib/components/HistoryList.svelte';
  import OfflineIndicator from '$lib/components/OfflineIndicator.svelte';
  import { payloadToQrString } from '$lib/payload';
  import { QR_MAX_LENGTH } from '$lib/qr';
  import { loadHistory, addEntry } from '$lib/history';
  import { randomId } from '$lib/uuid';
  import { auth } from '$lib/stores/auth';
  import type { Preset, HistoryEntry, QrPayload } from '$lib/types';

  let presets = $state<Preset[]>([]);
  let presetsLoaded = $state(false);
  let url = $state('');
  let history = $state<HistoryEntry[]>([]);

  onMount(async () => {
    history = loadHistory();
    try {
      const res = await fetch('/api/presets', { credentials: 'same-origin' });
      if (res.ok) {
        const body = (await res.json()) as { presets: Preset[] };
        presets = body.presets;
      }
    } catch {
      /* ignore */
    } finally {
      presetsLoaded = true;
    }
  });

  function recordAndNavigate(label: string, payload: QrPayload) {
    const entry: HistoryEntry = { id: randomId(), label, payload, createdAt: Date.now() };
    addEntry(entry);
    history = loadHistory();
    const params = new URLSearchParams({
      data: payloadToQrString(payload),
      label,
      kind: payload.kind
    });
    goto(`/qr?${params.toString()}`);
  }

  function onPreset(p: Preset) {
    recordAndNavigate(p.label, p);
  }
  function onUrlSubmit() {
    if (url) recordAndNavigate(url, { kind: 'url', value: url });
  }
  function onHistorySelect(e: HistoryEntry) {
    const params = new URLSearchParams({
      data: payloadToQrString(e.payload),
      label: e.label,
      kind: e.payload.kind
    });
    goto(`/qr?${params.toString()}`);
  }
</script>

<header class="page-head">
  <div class="head-text">
    <h1>QR erzeugen</h1>
    <p class="sub">Tippen, scannen lassen. Vor Ort, sofort.</p>
  </div>
  <OfflineIndicator />
</header>

{#if presetsLoaded && presets.length > 0}
  <section class="block" aria-label="Schnellzugriffe">
    <h2 class="block-title">Schnellzugriffe</h2>
    <PresetGrid {presets} onSelect={onPreset} />
  </section>
{:else if !presetsLoaded}
  <section class="block" aria-label="Presets">
    <p class="loading">Lade Schnellzugriffe…</p>
  </section>
{:else if !$auth}
  <section class="block notice" aria-label="Hinweis">
    <p>
      <strong>Tipp:</strong>
      <a href="/auth/login?return=/">Anmelden</a>, um persönliche Schnellzugriffe zu sehen.
    </p>
  </section>
{/if}

<section class="block" aria-label="URL eingeben">
  <h2 class="block-title">URL eingeben oder scannen</h2>
  <UrlInput value={url} onChange={(v) => (url = v)} />
  <button
    type="button"
    class="primary submit"
    disabled={!url || url.length > QR_MAX_LENGTH}
    onclick={onUrlSubmit}
  >
    QR erzeugen
  </button>
</section>

<section class="block" aria-label="Weitere Typen">
  <h2 class="block-title">Andere Typen</h2>
  <div class="more">
    <a class="type-card" href="/wifi">
      <span class="type-icon" aria-hidden="true">📶</span>
      <span class="type-label">WLAN</span>
    </a>
    <a class="type-card" href="/tel">
      <span class="type-icon" aria-hidden="true">📞</span>
      <span class="type-label">Telefon</span>
    </a>
    <a class="type-card" href="/contact">
      <span class="type-icon" aria-hidden="true">👤</span>
      <span class="type-label">Kontakt</span>
    </a>
  </div>
</section>

<HistoryList entries={history} onSelect={onHistorySelect} />

<style>
  .page-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }
  .head-text {
    flex: 1;
    min-width: 0;
  }
  .page-head :global(h1) {
    font-size: var(--text-2xl);
    margin: 0 0 var(--space-1);
    letter-spacing: -0.02em;
  }
  .sub {
    margin: 0;
    color: var(--ink-muted);
    font-size: var(--text-base);
  }

  .block {
    margin: 0 0 var(--space-5);
  }
  .block-title {
    font-size: var(--text-sm);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink);
    margin: 0 0 var(--space-3);
    padding-bottom: var(--space-1);
    border-bottom: var(--border-thick) solid var(--ink);
  }

  .submit {
    width: 100%;
    margin-top: var(--space-3);
    min-height: var(--tap-xl);
  }

  .loading {
    color: var(--ink-muted);
    padding: var(--space-3) 0;
  }

  .notice {
    padding: var(--space-3);
    border: var(--border-med) solid var(--ink);
    border-radius: var(--radius);
  }
  .notice p {
    margin: 0;
  }

  .more {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }
  .type-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 96px;
    padding: var(--space-3) var(--space-2);
    background: var(--paper);
    color: var(--ink);
    border: var(--border-med) solid var(--ink);
    border-radius: var(--radius);
    text-decoration: none;
    font-weight: 700;
    transition:
      transform 0.06s ease,
      background-color 0.1s ease,
      color 0.1s ease;
  }
  .type-card:hover {
    background: var(--ink);
    color: var(--paper);
    text-decoration: none;
  }
  .type-card:active {
    transform: scale(0.98);
  }
  .type-icon {
    font-size: 1.75rem;
    line-height: 1;
  }
  .type-label {
    font-size: var(--text-sm);
    letter-spacing: 0.02em;
  }

  @media (max-width: 480px) {
    .page-head {
      flex-direction: column;
      gap: var(--space-2);
      margin-bottom: var(--space-4);
    }
  }
</style>
