<script lang="ts">
  import type { Preset } from '$lib/types';

  interface Props {
    preset?: Preset;
    onSave: (p: Preset) => void;
    onCancel: () => void;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let { preset, onSave, onCancel }: Props = $props();
</script>

<p>PresetForm — TODO (Task 28)</p>
