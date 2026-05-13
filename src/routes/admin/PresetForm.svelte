<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Preset, QrKind } from '$lib/types';

  interface Props {
    preset?: Preset;
    onSave: (p: Preset) => void;
    onCancel: () => void;
  }
  let { preset, onSave, onCancel }: Props = $props();

  let label = $state(preset?.label ?? '');
  let icon = $state(preset?.icon ?? '');
  let kind = $state<QrKind>(preset?.kind ?? 'url');
  let urlValue = $state(preset?.kind === 'url' ? (preset.value as string) : '');
  let telValue = $state(preset?.kind === 'tel' ? (preset.value as string) : '');
  let textValue = $state(preset?.kind === 'text' ? (preset.value as string) : '');
  let ssid = $state(preset?.kind === 'wifi' ? preset.value.ssid : '');
  let password = $state(preset?.kind === 'wifi' ? preset.value.password : '');
  let encryption = $state<'WPA' | 'WEP' | 'nopass'>(
    preset?.kind === 'wifi' ? preset.value.encryption : 'WPA'
  );
  let hidden = $state(preset?.kind === 'wifi' ? !!preset.value.hidden : false);
  let name = $state(preset?.kind === 'vcard' ? preset.value.name : '');
  let tel = $state(preset?.kind === 'vcard' ? (preset.value.tel ?? '') : '');
  let email = $state(preset?.kind === 'vcard' ? (preset.value.email ?? '') : '');
  let org = $state(preset?.kind === 'vcard' ? (preset.value.org ?? '') : '');

  let busy = $state(false);
  let error = $state<string | null>(null);

  function buildValue(): unknown {
    switch (kind) {
      case 'url':
        return urlValue;
      case 'tel':
        return telValue;
      case 'text':
        return textValue;
      case 'wifi':
        return { ssid, password, encryption, hidden };
      case 'vcard':
        return {
          name,
          tel: tel || undefined,
          email: email || undefined,
          org: org || undefined
        };
    }
  }

  async function submit(e: Event) {
    e.preventDefault();
    busy = true;
    error = null;
    const payload = { label, icon: icon || undefined, kind, value: buildValue() };
    const target = preset ? `/api/presets/${encodeURIComponent(preset.id)}` : '/api/presets';
    const res = await fetch(target, {
      method: preset ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    busy = false;
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      error = body.error ?? `Fehler ${res.status}`;
      return;
    }
    onSave((await res.json()) as Preset);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  onMount(() => {
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  });
  onDestroy(() => {
    document.removeEventListener('keydown', onKey);
  });
</script>

<div
  class="overlay"
  role="dialog"
  aria-modal="true"
  aria-label={preset ? 'Preset bearbeiten' : 'Neues Preset'}
>
  <div class="modal">
    <header class="modal-head">
      <h2>{preset ? 'Preset bearbeiten' : 'Neues Preset'}</h2>
      <button type="button" class="close" aria-label="Schließen" onclick={onCancel}>×</button>
    </header>

    <form onsubmit={submit} class="preset-form">
      <div class="body">
        <div class="field">
          <label for="pf-label">Bezeichnung</label>
          <input id="pf-label" bind:value={label} maxlength="80" required />
        </div>

        <div class="field">
          <label for="pf-icon">Icon (optional)</label>
          <input id="pf-icon" bind:value={icon} maxlength="4" placeholder="z. B. 📍" />
          <p class="hint">Emoji oder ein einzelnes Zeichen.</p>
        </div>

        <div class="field">
          <label for="pf-kind">Art</label>
          <select id="pf-kind" bind:value={kind} disabled={!!preset}>
            <option value="url">URL</option>
            <option value="wifi">WLAN</option>
            <option value="tel">Telefon</option>
            <option value="vcard">Kontakt</option>
            <option value="text">Text</option>
          </select>
          {#if preset}
            <p class="hint">Art kann nach dem Anlegen nicht geändert werden.</p>
          {/if}
        </div>

        {#if kind === 'url'}
          <div class="field">
            <label for="pf-url">URL</label>
            <input id="pf-url" type="url" bind:value={urlValue} required />
          </div>
        {:else if kind === 'tel'}
          <div class="field">
            <label for="pf-tel">Telefonnummer</label>
            <input id="pf-tel" type="tel" bind:value={telValue} required />
          </div>
        {:else if kind === 'text'}
          <div class="field">
            <label for="pf-text">Text</label>
            <textarea id="pf-text" bind:value={textValue} required></textarea>
          </div>
        {:else if kind === 'wifi'}
          <div class="field">
            <label for="pf-ssid">SSID</label>
            <input id="pf-ssid" bind:value={ssid} required />
          </div>
          <div class="field">
            <label for="pf-pass">Passwort</label>
            <input id="pf-pass" bind:value={password} />
          </div>
          <div class="field">
            <label for="pf-enc">Verschlüsselung</label>
            <select id="pf-enc" bind:value={encryption}>
              <option value="WPA">WPA</option>
              <option value="WEP">WEP</option>
              <option value="nopass">offen</option>
            </select>
          </div>
          <label class="check">
            <input type="checkbox" bind:checked={hidden} />
            <span>Versteckt</span>
          </label>
        {:else if kind === 'vcard'}
          <div class="field">
            <label for="pf-name">Name</label>
            <input id="pf-name" bind:value={name} required />
          </div>
          <div class="field">
            <label for="pf-vtel">Telefon</label>
            <input id="pf-vtel" type="tel" bind:value={tel} />
          </div>
          <div class="field">
            <label for="pf-email">E-Mail</label>
            <input id="pf-email" type="email" bind:value={email} />
          </div>
          <div class="field">
            <label for="pf-org">Organisation</label>
            <input id="pf-org" bind:value={org} />
          </div>
        {/if}

        {#if error}<p class="error" role="alert">{error}</p>{/if}
      </div>

      <div class="actions">
        <button type="button" class="secondary cancel" onclick={onCancel} disabled={busy}>
          Abbrechen
        </button>
        <button type="submit" class="primary" disabled={busy}>
          {preset ? 'Speichern' : 'Anlegen'}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 200;
    display: flex;
    align-items: stretch;
    justify-content: center;
    padding: 0;
  }

  .modal {
    background: var(--paper);
    color: var(--ink);
    width: 100%;
    max-width: 600px;
    max-height: 100vh;
    display: flex;
    flex-direction: column;
    border: var(--border-thick) solid var(--ink);
  }

  @media (min-width: 640px) {
    .overlay {
      padding: var(--space-4);
      align-items: center;
    }
    .modal {
      max-height: calc(100vh - var(--space-5));
      border-radius: var(--radius);
    }
  }

  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3);
    border-bottom: var(--border-thick) solid var(--ink);
    flex: 0 0 auto;
  }
  .modal-head h2 {
    margin: 0;
    font-size: var(--text-lg);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .close {
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    font-size: 1.75rem;
    font-weight: 800;
    background: var(--paper);
    color: var(--ink);
    border: var(--border-med) solid var(--ink);
    line-height: 1;
  }
  .close:hover:not(:disabled) {
    background: var(--ink);
    color: var(--paper);
  }

  .preset-form {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .body {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
    overflow-y: auto;
    flex: 1;
  }
  .field {
    display: grid;
    gap: var(--space-1);
  }
  .hint {
    margin: 0;
    color: var(--ink-muted);
    font-size: var(--text-sm);
  }
  .check {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 600;
    margin: 0;
  }
  .error {
    margin: 0;
    color: var(--danger);
    font-weight: 700;
    padding: var(--space-2) var(--space-3);
    border: var(--border-med) solid var(--danger);
    border-radius: var(--radius);
  }

  .actions {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3);
    border-top: var(--border-thick) solid var(--ink);
    flex: 0 0 auto;
    position: sticky;
    bottom: 0;
    background: var(--paper);
  }
  .actions .cancel {
    flex: 1;
  }
  .actions .primary {
    flex: 2;
    min-height: var(--tap);
  }
</style>
