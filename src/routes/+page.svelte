<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import PresetGrid from '$lib/components/PresetGrid.svelte';
  import UrlInput from '$lib/components/UrlInput.svelte';
  import HistoryList from '$lib/components/HistoryList.svelte';
  import OfflineIndicator from '$lib/components/OfflineIndicator.svelte';
  import { allPresets } from '$lib/presets';
  import { payloadToQrString } from '$lib/payload';
  import { loadHistory, addEntry } from '$lib/history';
  import { randomId } from '$lib/uuid';
  import type { Preset, HistoryEntry, QrPayload } from '$lib/types';

  let presets = allPresets();
  let url = $state('');
  let history = $state<HistoryEntry[]>([]);

  onMount(() => {
    history = loadHistory();
  });

  function recordAndNavigate(label: string, payload: QrPayload) {
    const entry: HistoryEntry = {
      id: randomId(),
      label,
      payload,
      createdAt: Date.now()
    };
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
    recordAndNavigate(p.label, { kind: p.kind, value: p.value } as QrPayload);
  }

  function onUrlSubmit() {
    if (!url) return;
    recordAndNavigate(url, { kind: 'url', value: url });
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

<header>
  <h1>QR-Generator</h1>
  <OfflineIndicator />
</header>

<section aria-label="Presets">
  <PresetGrid {presets} onSelect={onPreset} />
</section>

<section aria-label="URL eingeben">
  <UrlInput value={url} onChange={(v) => (url = v)} />
  <button
    type="button"
    disabled={!url || url.length > 1273}
    onclick={onUrlSubmit}
  >
    QR erzeugen
  </button>
</section>

<section aria-label="Weitere Typen" class="more">
  <a class="button secondary" href="/wifi">📶 WLAN</a>
  <a class="button secondary" href="/tel">📞 Telefon</a>
  <a class="button secondary" href="/contact">👤 Kontakt</a>
</section>

<HistoryList entries={history} onSelect={onHistorySelect} />

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  h1 {
    font-size: 1.3rem;
    margin: 0;
  }
  section {
    margin: 1.5rem 0;
  }
  .more {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }
</style>
