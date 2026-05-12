<!-- src/routes/wifi/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { payloadToQrString } from '$lib/payload';
  import { addEntry } from '$lib/history';
  import { randomId } from '$lib/uuid';

  let ssid = $state('');
  let password = $state('');
  let encryption = $state<'WPA' | 'WEP' | 'nopass'>('WPA');
  let hidden = $state(false);

  let canSubmit = $derived(ssid.trim().length > 0);

  function submit(e: Event) {
    e.preventDefault();
    if (!canSubmit) return;
    const payload = {
      kind: 'wifi' as const,
      value: { ssid: ssid.trim(), password, encryption, hidden }
    };
    addEntry({
      id: randomId(),
      label: `WLAN: ${ssid.trim()}`,
      payload,
      createdAt: Date.now()
    });
    const params = new URLSearchParams({
      data: payloadToQrString(payload),
      label: `WLAN: ${ssid.trim()}`,
      kind: 'wifi'
    });
    goto(`/qr?${params.toString()}`);
  }
</script>

<a class="button secondary back" href="/">← Zurück</a>
<h1>WLAN</h1>

<form onsubmit={submit}>
  <label>
    SSID
    <input type="text" bind:value={ssid} required autocomplete="off" />
  </label>

  <label>
    Passwort
    <input type="text" bind:value={password} autocomplete="off" />
  </label>

  <fieldset>
    <legend>Verschlüsselung</legend>
    <label><input type="radio" bind:group={encryption} value="WPA" /> WPA / WPA2</label>
    <label><input type="radio" bind:group={encryption} value="WEP" /> WEP</label>
    <label><input type="radio" bind:group={encryption} value="nopass" /> Keine</label>
  </fieldset>

  <label class="checkbox">
    <input type="checkbox" bind:checked={hidden} /> Verstecktes Netzwerk
  </label>

  <button type="submit" disabled={!canSubmit}>QR erzeugen</button>
</form>

<style>
  h1 {
    font-size: 1.3rem;
  }
  form {
    display: grid;
    gap: 1rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
  }
  fieldset {
    border: 2px solid var(--fg);
    border-radius: 8px;
    display: grid;
    gap: 0.5rem;
  }
  .checkbox {
    flex-direction: row;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .back {
    display: inline-flex;
    margin-bottom: 1rem;
  }
</style>
