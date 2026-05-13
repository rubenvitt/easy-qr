<!-- src/routes/tel/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { payloadToQrString } from '$lib/payload';
  import { addEntry } from '$lib/history';
  import { randomId } from '$lib/uuid';

  let number = $state('');

  function submit(e: Event) {
    e.preventDefault();
    if (!number) return;
    const payload = { kind: 'tel' as const, value: number };
    addEntry({
      id: randomId(),
      label: `Tel: ${number}`,
      payload,
      createdAt: Date.now()
    });
    const params = new URLSearchParams({
      data: payloadToQrString(payload),
      label: `Tel: ${number}`,
      kind: 'tel'
    });
    goto(`/qr?${params.toString()}`);
  }
</script>

<a class="button ghost back" href="/">← Zurück</a>
<h1>Telefonnummer</h1>
<p class="lede">Beim Scannen öffnet sich der Wählvorgang im Telefon.</p>

<form onsubmit={submit} class="form">
  <div class="field">
    <label for="tel-number">Nummer</label>
    <input
      id="tel-number"
      type="tel"
      bind:value={number}
      placeholder="+49 151 12345678"
      required
    />
    <p class="hint">Internationales Format mit Ländervorwahl empfohlen (z. B. +49…).</p>
  </div>

  <button type="submit" class="primary submit" disabled={!number}>QR erzeugen</button>
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
  .submit {
    min-height: var(--tap-xl);
    margin-top: var(--space-2);
  }
</style>
