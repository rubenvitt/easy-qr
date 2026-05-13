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

<a class="button ghost back" href="/">← Zurück</a>
<h1>Kontakt-Visitenkarte</h1>
<p class="lede">vCard zum Speichern im Adressbuch des Scanners.</p>

<form onsubmit={submit} class="form">
  <div class="field">
    <label for="c-name">Name</label>
    <input id="c-name" type="text" bind:value={name} required />
  </div>
  <div class="field">
    <label for="c-tel">Telefon</label>
    <input id="c-tel" type="tel" bind:value={tel} />
  </div>
  <div class="field">
    <label for="c-email">E-Mail</label>
    <input id="c-email" type="email" bind:value={email} />
  </div>
  <div class="field">
    <label for="c-org">Organisation</label>
    <input id="c-org" type="text" bind:value={org} />
  </div>
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
  .submit {
    min-height: var(--tap-xl);
    margin-top: var(--space-2);
  }
</style>
