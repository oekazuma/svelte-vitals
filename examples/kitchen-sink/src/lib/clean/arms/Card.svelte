<!-- Its <h2> renders whenever a use passes a non-blank title, and every use does. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, children }: { title: string; children?: Snippet } = $props();
  const shown = $derived(title?.trim() ?? '');
</script>

{#if shown}
  <h2>{shown}</h2>
{/if}
{@render children?.()}
