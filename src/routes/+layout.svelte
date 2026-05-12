<script lang="ts">
  import '../app.css';
  import UpdatePrompt from '$lib/components/UpdatePrompt.svelte';
  let { children } = $props();
</script>

<UpdatePrompt />
<main>{@render children()}</main>

<style>
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 1rem;
  }
</style>
