<!-- src/routes/contact/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { payloadToQrString } from '$lib/payload';
  import { addEntry } from '$lib/history';
  import { randomId } from '$lib/uuid';

  let name = $state('');
  let tel = $state('');
  let email = $state('');
  let org = $state('');

  let canSubmit = $derived(name.trim().length > 0);

  function submit(e: Event) {
    e.preventDefault();
    if (!canSubmit) return;
    const payload = {
      kind: 'vcard' as const,
      value: {
        name: name.trim(),
        tel: tel.trim() || undefined,
        email: email.trim() || undefined,
        org: org.trim() || undefined
      }
    };
    addEntry({
      id: randomId(),
      label: name.trim(),
      payload,
      createdAt: Date.now()
    });
    const params = new URLSearchParams({
      data: payloadToQrString(payload),
      label: name.trim(),
      kind: 'vcard'
    });
    goto(`/qr?${params.toString()}`);
  }
</script>

<a class="button secondary back" href="/">← Zurück</a>
<h1>Kontakt</h1>

<form onsubmit={submit}>
  <label>Name<input type="text" bind:value={name} required /></label>
  <label>Telefon<input type="tel" bind:value={tel} /></label>
  <label>E-Mail<input type="email" bind:value={email} /></label>
  <label>Organisation<input type="text" bind:value={org} /></label>
  <button type="submit" disabled={!canSubmit}>QR erzeugen</button>
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
