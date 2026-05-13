<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import UpdatePrompt from '$lib/components/UpdatePrompt.svelte';
  import Logo from '$lib/components/Logo.svelte';
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

<nav class="topbar" aria-label="Hauptnavigation">
  <a href="/" class="brand" aria-label="QR — Startseite">
    <Logo width={28} height={28} />
    <span class="word">QR</span>
  </a>
  <div class="spacer"></div>

  {#if $auth}
    {#if $auth.role === 'admin'}
      <a class="admin-link" href="/admin" aria-label="Presets verwalten">
        <span class="cog" aria-hidden="true">⚙</span>
        <span class="admin-label">Verwalten</span>
      </a>
    {/if}
    <span class="user" title={$auth.email}>{$auth.displayName ?? $auth.email}</span>
    <button type="button" class="ghost logout" onclick={() => logout()}>Abmelden</button>
  {:else}
    <a class="button secondary login" href={loginHref()}>
      <span aria-hidden="true">🔑</span>
      <span>Anmelden</span>
    </a>
  {/if}
</nav>

<UpdatePrompt />
<main>{@render children()}</main>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    height: 64px;
    padding: 0 var(--space-3);
    background: var(--paper);
    color: var(--ink);
    border-bottom: var(--border-thick) solid var(--ink);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    text-decoration: none;
    color: var(--ink);
    font-weight: 800;
    font-size: 1.5rem;
    letter-spacing: -0.02em;
    line-height: 1;
    padding: var(--space-1) var(--space-2);
    margin-left: calc(-1 * var(--space-2));
    border-radius: var(--radius-sm);
  }

  .brand:hover {
    text-decoration: none;
  }

  .word {
    display: inline-block;
  }

  .spacer {
    flex: 1;
  }

  .admin-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--ink);
    text-decoration: none;
    font-weight: 700;
    padding: var(--space-2) var(--space-3);
    border: var(--border-med) solid transparent;
    border-radius: var(--radius);
    min-height: var(--tap);
  }

  .admin-link:hover {
    border-color: var(--ink);
    text-decoration: none;
  }

  .cog {
    font-size: 1.25rem;
    line-height: 1;
  }

  .user {
    font-size: var(--text-sm);
    color: var(--ink-muted);
    padding: var(--space-1) var(--space-2);
    border: var(--border-med) solid var(--ink);
    border-radius: var(--radius);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .logout {
    font-size: var(--text-sm);
  }

  .login {
    min-height: 48px;
    padding: 0 var(--space-3);
  }

  main {
    max-width: 720px;
    margin: 0 auto;
    padding: var(--space-4) var(--space-3) var(--space-6);
  }

  @media (max-width: 480px) {
    .topbar {
      padding: 0 var(--space-2);
      gap: var(--space-2);
    }
    .brand {
      font-size: 1.25rem;
    }
    .admin-label {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .user {
      max-width: 100px;
      font-size: var(--text-xs);
    }
    main {
      padding: var(--space-3) var(--space-3) var(--space-6);
    }
  }
</style>
