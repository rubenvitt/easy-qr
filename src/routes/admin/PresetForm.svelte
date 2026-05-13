<script lang="ts">
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
</script>

<form onsubmit={submit} class="preset-form">
  <label>Bezeichnung <input bind:value={label} maxlength="80" required /> </label>
  <label>Icon (optional) <input bind:value={icon} maxlength="4" /></label>
  <label
    >Art
    <select bind:value={kind} disabled={!!preset}>
      <option value="url">URL</option>
      <option value="wifi">WLAN</option>
      <option value="tel">Telefon</option>
      <option value="vcard">Kontakt</option>
      <option value="text">Text</option>
    </select>
  </label>

  {#if kind === 'url'}
    <label>URL <input type="url" bind:value={urlValue} required /></label>
  {:else if kind === 'tel'}
    <label>Telefonnummer <input type="tel" bind:value={telValue} required /></label>
  {:else if kind === 'text'}
    <label>Text <textarea bind:value={textValue} required></textarea></label>
  {:else if kind === 'wifi'}
    <label>SSID <input bind:value={ssid} required /></label>
    <label>Passwort <input bind:value={password} /></label>
    <label
      >Verschlüsselung
      <select bind:value={encryption}>
        <option>WPA</option>
        <option>WEP</option>
        <option value="nopass">offen</option>
      </select>
    </label>
    <label><input type="checkbox" bind:checked={hidden} /> Versteckt</label>
  {:else if kind === 'vcard'}
    <label>Name <input bind:value={name} required /></label>
    <label>Telefon <input type="tel" bind:value={tel} /></label>
    <label>E-Mail <input type="email" bind:value={email} /></label>
    <label>Organisation <input bind:value={org} /></label>
  {/if}

  {#if error}<p class="error">{error}</p>{/if}

  <div class="actions">
    <button type="submit" disabled={busy}>{preset ? 'Speichern' : 'Anlegen'}</button>
    <button type="button" onclick={onCancel}>Abbrechen</button>
  </div>
</form>
