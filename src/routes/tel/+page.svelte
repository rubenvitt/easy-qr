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

<a class="button secondary back" href="/">← Zurück</a>
<h1>Telefon</h1>

<form onsubmit={submit}>
  <label>
    Nummer
    <input type="tel" bind:value={number} placeholder="+4915112345678" required />
  </label>
  <button type="submit" disabled={!number}>QR erzeugen</button>
</form>

<style>
  form {
    display: grid;
    gap: 1rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
  }
  .back {
    display: inline-flex;
    margin-bottom: 1rem;
  }
</style>
