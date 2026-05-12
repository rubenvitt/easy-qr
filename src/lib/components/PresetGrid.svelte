<script lang="ts">
  import type { Preset } from '$lib/types';

  interface Props {
    presets: Preset[];
    onSelect: (p: Preset) => void;
  }
  let { presets, onSelect }: Props = $props();
</script>

<div class="grid" role="list">
  {#each presets as p (p.id)}
    <button type="button" role="listitem" onclick={() => onSelect(p)}>
      {#if p.icon}<span class="icon" aria-hidden="true">{p.icon}</span>{/if}
      <span class="label">{p.label}</span>
    </button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
  .grid button {
    flex-direction: column;
    min-height: 96px;
    padding: 1rem;
    font-size: 1rem;
    text-align: center;
    white-space: normal;
  }
  .icon {
    font-size: 2rem;
  }
</style>
