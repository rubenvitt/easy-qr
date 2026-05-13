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

<a class="button ghost back" href="/">← Zurück</a>
<h1>WLAN-Zugang</h1>
<p class="lede">QR-Code zum Beitreten eines Funknetzes. Geräte verbinden sich mit einem Scan.</p>

<form onsubmit={submit} class="form">
  <div class="field">
    <label for="wifi-ssid">SSID (Netzwerkname)</label>
    <input id="wifi-ssid" type="text" bind:value={ssid} required autocomplete="off" />
  </div>

  <div class="field">
    <label for="wifi-pass">Passwort</label>
    <input id="wifi-pass" type="text" bind:value={password} autocomplete="off" />
    <p class="hint">Leer lassen, wenn das Netz offen ist.</p>
  </div>

  <fieldset>
    <legend>Verschlüsselung</legend>
    <div class="radios">
      <label class="check"
        ><input type="radio" bind:group={encryption} value="WPA" /> WPA / WPA2</label
      >
      <label class="check"><input type="radio" bind:group={encryption} value="WEP" /> WEP</label>
      <label class="check"
        ><input type="radio" bind:group={encryption} value="nopass" /> Keine</label
      >
    </div>
  </fieldset>

  <label class="check standalone">
    <input type="checkbox" bind:checked={hidden} />
    <span>Verstecktes Netzwerk</span>
  </label>

  <button type="submit" class="primary submit" disabled={!canSubmit}>QR erzeugen</button>
</form>

<style>
  .back {
    margin-bottom: var(--space-3);
  }
  h1 {
    margin-bottom: var(--space-1);
  }
  .lede {
    color: var(--ink-muted);
    margin-bottom: var(--space-4);
  }
  .form {
    display: grid;
    gap: var(--space-4);
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
  .radios {
    display: grid;
    gap: var(--space-2);
  }
  .check {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
    font-size: var(--text-base);
    margin: 0;
    min-height: 32px;
  }
  .check.standalone {
    padding: var(--space-2) 0;
  }
  .submit {
    min-height: var(--tap-xl);
    margin-top: var(--space-2);
  }
</style>
