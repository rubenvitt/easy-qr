<script lang="ts">
  import type { Preset } from '$lib/types';

  interface Props {
    presets: Preset[];
    onSelect: (p: Preset) => void;
  }
  let { presets, onSelect }: Props = $props();

  function fallbackLetter(label: string): string {
    return label.trim().charAt(0).toUpperCase() || '?';
  }
</script>

<ul class="grid">
  {#each presets as p (p.id)}
    <li>
      <button type="button" onclick={() => onSelect(p)} class="preset">
        <span class="icon-wrap" aria-hidden="true">
          {#if p.icon}
            <span class="icon">{p.icon}</span>
          {:else}
            <span class="icon-fallback">{fallbackLetter(p.label)}</span>
          {/if}
        </span>
        <span class="label">{p.label}</span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .grid {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-2);
  }
  @media (min-width: 600px) {
    .grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .preset {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    min-height: 128px;
    padding: var(--space-3) var(--space-2);
    gap: var(--space-2);
    background: var(--paper);
    color: var(--ink);
    border: var(--border-med) solid var(--ink);
    border-radius: var(--radius);
    font-size: var(--text-sm);
    text-align: center;
    white-space: normal;
    line-height: 1.3;
    font-weight: 700;
  }

  .preset:hover:not(:disabled) {
    background: var(--ink);
    color: var(--paper);
  }
  .preset:active:not(:disabled) {
    transform: scale(0.98);
  }

  .icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
  }
  .icon {
    font-size: 2rem;
    line-height: 1;
  }
  .icon-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    font-size: 1.25rem;
    font-weight: 800;
    border: var(--border-med) solid currentColor;
    border-radius: var(--radius-sm);
  }
  .label {
    font-size: var(--text-sm);
    letter-spacing: 0.01em;
  }
</style>
