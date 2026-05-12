<script lang="ts">
  import type { Preset } from '$lib/types';

  interface Props {
    presets: Preset[];
    onSelect: (p: Preset) => void;
  }
  let { presets, onSelect }: Props = $props();
</script>

<ul class="grid">
  {#each presets as p (p.id)}
    <li>
      <button type="button" onclick={() => onSelect(p)}>
        {#if p.icon}<span class="icon" aria-hidden="true">{p.icon}</span>{/if}
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
    gap: 0.75rem;
  }
  .grid button {
    width: 100%;
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
