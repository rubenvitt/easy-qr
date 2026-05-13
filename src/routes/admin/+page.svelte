<script lang="ts">
  import { onMount } from 'svelte';
  import type { Preset } from '$lib/types';
  import PresetForm from './PresetForm.svelte';

  let presets = $state<Preset[]>([]);
  let editing = $state<Preset | null>(null);
  let creating = $state(false);
  let error = $state<string | null>(null);

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

<h1>Presets verwalten</h1>
{#if error}<p class="error">{error}</p>{/if}
<button type="button" onclick={() => (creating = true)}>+ Neues Preset</button>

{#if creating}
  <PresetForm onSave={saved} onCancel={() => (creating = false)} />
{/if}

<ul>
  {#each presets as p, i (p.id)}
    <li>
      <span>{p.icon ?? ''} {p.label} <code>({p.kind})</code></span>
      <button type="button" onclick={() => move(i, -1)} aria-label="nach oben">↑</button>
      <button type="button" onclick={() => move(i, 1)} aria-label="nach unten">↓</button>
      <button type="button" onclick={() => (editing = p)}>Bearbeiten</button>
      <button type="button" onclick={() => remove(p)}>Löschen</button>
    </li>
  {/each}
</ul>

{#if editing}
  <PresetForm preset={editing} onSave={saved} onCancel={() => (editing = null)} />
{/if}
