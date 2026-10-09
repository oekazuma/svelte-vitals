<script lang="ts">
  import { page } from '$app/state';

  let { children } = $props();
  const id = $derived(page.route.id);
</script>

{#if id === '/clean/bom-arms'}
  <h1>BOM arms</h1>
{/if}
{@render children()}
