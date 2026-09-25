<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<svelte:boundary>
  {@render children()}

  {#snippet failed(_error, reset)}
    <h1>Something went wrong</h1>
    <p>This section failed to render.</p>
    <button type="button" onclick={reset}>Try again</button>
  {/snippet}
</svelte:boundary>
