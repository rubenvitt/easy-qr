<script lang="ts">
  import { onMount } from 'svelte';
  import type { Preset, QrKind } from '$lib/types';
  import PresetForm from './PresetForm.svelte';

  let presets = $state<Preset[]>([]);
  let editing = $state<Preset | null>(null);
  let creating = $state(false);
  let error = $state<string | null>(null);

  const KIND_LABEL: Record<QrKind, string> = {
    url: 'URL',
    wifi: 'WLAN',
    tel: 'Telefon',
    vcard: 'Kontakt',
    text: 'Text'
  };

  async function refresh() {
    const res = await fetch('/api/presets');
    if (!res.ok) {
      error = `Laden fehlgeschlagen (${res.status})`;
      return;
    }
    presets = ((await res.json()) as { presets: Preset[] }).presets;
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= presets.length) return;
    const ids = presets.map((p) => p.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const res = await fetch('/api/presets/reorder', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if (res.ok) await refresh();
  }

  async function remove(p: Preset) {
    if (!confirm(`"${p.label}" löschen?`)) return;
    const res = await fetch(`/api/presets/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
    if (res.status === 204 || res.status === 404) await refresh();
    else error = `Löschen fehlgeschlagen (${res.status})`;
  }

  async function saved() {
    editing = null;
    creating = false;
    await refresh();
  }

  onMount(refresh);
</script>

<header class="head">
  <div>
    <h1>Presets</h1>
    <p class="lede">Schnellzugriffe für die Startseite verwalten.</p>
  </div>
  <button type="button" class="primary new" onclick={() => (creating = true)}>
    + Neues Preset
  </button>
</header>

{#if error}<p class="error" role="alert">{error}</p>{/if}

{#if presets.length === 0}
  <div class="empty">
    <p>Noch keine Presets angelegt.</p>
  </div>
{:else}
  <ul class="rows" role="list">
    <li class="row head-row" aria-hidden="true">
      <span class="col-label">Bezeichnung</span>
      <span class="col-kind">Typ</span>
      <span class="col-actions">Aktionen</span>
    </li>
    {#each presets as p, i (p.id)}
      <li class="row">
        <span class="col-label">
          <span class="icon" aria-hidden="true">{p.icon ?? '•'}</span>
          <span class="label-text">{p.label}</span>
        </span>
        <span class="col-kind">
          <span class="badge">{KIND_LABEL[p.kind]}</span>
        </span>
        <span class="col-actions">
          <button
            type="button"
            class="icon-btn"
            aria-label="nach oben"
            disabled={i === 0}
            onclick={() => move(i, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            class="icon-btn"
            aria-label="nach unten"
            disabled={i === presets.length - 1}
            onclick={() => move(i, 1)}
          >
            ↓
          </button>
          <button
            type="button"
            class="icon-btn"
            aria-label="Bearbeiten"
            onclick={() => (editing = p)}
          >
            ✎
          </button>
          <button
            type="button"
            class="icon-btn danger"
            aria-label="Löschen"
            onclick={() => remove(p)}
          >
            ✕
          </button>
        </span>
      </li>
    {/each}
  </ul>
{/if}

{#if creating}
  <PresetForm onSave={saved} onCancel={() => (creating = false)} />
{/if}

{#if editing}
  <PresetForm preset={editing} onSave={saved} onCancel={() => (editing = null)} />
{/if}

<style>
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .head h1 {
    margin: 0;
  }
  .lede {
    margin: var(--space-1) 0 0;
    color: var(--ink-muted);
  }
  .new {
    flex-shrink: 0;
    min-height: var(--tap);
    font-size: var(--text-base);
  }

  .error {
    background: var(--paper);
    color: var(--danger);
    border: var(--border-med) solid var(--danger);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    font-weight: 700;
    margin-bottom: var(--space-3);
  }

  .empty {
    border: var(--border-med) dashed var(--ink);
    border-radius: var(--radius);
    padding: var(--space-5) var(--space-3);
    text-align: center;
    color: var(--ink-muted);
  }
  .empty p {
    margin: 0;
  }

  .rows {
    list-style: none;
    padding: 0;
    margin: 0;
    border: var(--border-med) solid var(--ink);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    min-height: var(--tap);
  }
  .row + .row {
    border-top: 1px solid var(--ink);
  }
  .head-row {
    background: var(--ink);
    color: var(--paper);
    text-transform: uppercase;
    font-size: var(--text-xs);
    letter-spacing: 0.1em;
    font-weight: 800;
    min-height: 40px;
  }
  .col-label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    overflow: hidden;
  }
  .label-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 700;
  }
  .icon {
    font-size: 1.25rem;
    line-height: 1;
    flex: 0 0 auto;
  }
  .badge {
    display: inline-block;
    padding: 4px var(--space-2);
    border: var(--border-med) solid currentColor;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .col-actions {
    display: inline-flex;
    gap: var(--space-1);
  }

  .icon-btn {
    min-width: 40px;
    min-height: 40px;
    padding: 0;
    font-size: var(--text-lg);
    background: var(--paper);
    color: var(--ink);
    border: var(--border-med) solid var(--ink);
    font-weight: 800;
    line-height: 1;
  }
  .icon-btn:hover:not(:disabled) {
    background: var(--ink);
    color: var(--paper);
  }
  .icon-btn.danger {
    color: var(--danger);
    border-color: var(--danger);
  }
  .icon-btn.danger:hover:not(:disabled) {
    background: var(--danger);
    color: var(--danger-ink);
  }

  @media (max-width: 600px) {
    .head {
      flex-direction: column;
    }
    .new {
      width: 100%;
    }
    .row {
      grid-template-columns: 1fr auto;
      grid-template-rows: auto auto;
      gap: var(--space-2);
    }
    .col-label {
      grid-column: 1 / span 2;
    }
    .head-row {
      display: none;
    }
    .col-actions {
      justify-self: end;
    }
  }
</style>
