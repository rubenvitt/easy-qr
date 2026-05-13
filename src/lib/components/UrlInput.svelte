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

  function clear() {
    onChange('');
    (document.getElementById('url-field') as HTMLInputElement | null)?.focus();
  }
</script>

<label for="url-field">URL</label>
<div class="row">
  <div class="field" class:has-value={value.length > 0}>
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
    {#if value.length > 0}
      <button type="button" class="clear" aria-label="Eingabe löschen" onclick={clear}>×</button>
    {/if}
  </div>
  <button type="button" class="secondary paste" onclick={pasteFromClipboard}>
    <span aria-hidden="true">📋</span>
    <span>Einfügen</span>
  </button>
</div>
<p class="hint" class:warn={tooLong}>
  {#if tooLong}
    Eingabe zu lang ({value.length} / {QR_MAX_LENGTH} Zeichen)
  {:else}
    z. B. https://lage.beispiel.de — wird direkt zum QR.
  {/if}
</p>

<style>
  .row {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .field {
    position: relative;
    flex: 1 1 240px;
    min-width: 0;
  }

  .field input {
    padding-right: var(--space-5);
  }

  .clear {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    min-width: 40px;
    min-height: 40px;
    padding: 0;
    font-size: 1.5rem;
    line-height: 1;
    border: var(--border-med) solid transparent;
    background: transparent;
    color: var(--ink);
    border-radius: var(--radius-sm);
    font-weight: 800;
  }

  .clear:hover:not(:disabled) {
    background: var(--surface-2);
    color: var(--ink);
  }

  .paste {
    flex: 0 0 auto;
  }

  .hint {
    margin: var(--space-2) 0 0;
    color: var(--ink-muted);
    font-size: var(--text-sm);
  }

  .hint.warn {
    color: var(--danger);
    font-weight: 700;
  }
</style>
