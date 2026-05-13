<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import UpdatePrompt from '$lib/components/UpdatePrompt.svelte';
  import { auth, refreshAuth, setAuthUser, logout } from '$lib/stores/auth';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
  setAuthUser(data.user);
  onMount(() => {
    refreshAuth();
  });

  function loginHref(): string {
    const ret = encodeURIComponent($page.url.pathname + $page.url.search);
    return `/auth/login?return=${ret}`;
  }
</script>

<nav class="topbar">
  <a href="/" class="brand">DRK QR</a>
  <div class="spacer"></div>
  {#if $auth}
    {#if $auth.role === 'admin'}
      <a class="link" href="/admin">⚙️ Verwalten</a>
    {/if}
    <span class="user" title={$auth.email}>{$auth.displayName ?? $auth.email}</span>
    <button type="button" class="link" onclick={() => logout()}>Abmelden</button>
  {:else}
    <a class="link" href={loginHref()}>🔑 Anmelden</a>
  {/if}
</nav>

<UpdatePrompt />
<main>{@render children()}</main>

<style>
  .topbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #eee;
  }
  .brand {
    font-weight: 600;
    text-decoration: none;
  }
  .spacer {
    flex: 1;
  }
  .user {
    color: #555;
    font-size: 0.9rem;
  }
  .link {
    background: none;
    border: none;
    padding: 0;
    color: #0366d6;
    cursor: pointer;
  }
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 1rem;
  }
</style>
