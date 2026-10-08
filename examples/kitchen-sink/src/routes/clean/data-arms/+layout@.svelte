<!-- Signed in, the layout wraps the page in its <main>; signed out, the page brings its own (see the page). -->
<script lang="ts">
  import type { LayoutData } from './$types';
  import type { Snippet } from 'svelte';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

{#if data.user}
  <main>
    <p>Signed in as {data.user.name}</p>
    {@render children()}
  </main>
{:else}
  {@render children()}
{/if}
