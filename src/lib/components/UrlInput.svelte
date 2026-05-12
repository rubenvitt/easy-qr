<script lang="ts">
  import { QR_MAX_LENGTH } from '$lib/qr';

  interface Props {
    value: string;
    onChange: (next: string) => void;
  }
  let { value, onChange }: Props = $props();

  let tooLong = $derived(value.length > QR_MAX_LENGTH);

  async function pasteFromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      onChange(t.trim());
    } catch {
      (document.getElementById('url-field') as HTMLInputElement | null)?.focus();
    }
  }
</script>

<label for="url-field">URL</label>
<div class="row">
  <input
    id="url-field"
    type="url"
    inputmode="url"
    autocomplete="off"
    spellcheck="false"
    placeholder="https://…"
    {value}
    oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
  />
  <button type="button" class="secondary" onclick={pasteFromClipboard}>📋 Einfügen</button>
</div>
{#if tooLong}
  <p class="hint">Eingabe zu lang ({value.length} / {QR_MAX_LENGTH})</p>
{/if}

<style>
  .row {
    display: flex;
    gap: 0.5rem;
  }
  .row input {
    flex: 1;
  }
  .hint {
    color: var(--muted);
    font-size: 0.95rem;
  }
</style>
