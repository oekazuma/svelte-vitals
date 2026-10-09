<script lang="ts">
  import { page } from '$app/state';

  let { children } = $props();
  const BARE = ['/clean/list-arms/bare'];
</script>

{#if BARE.some((r) => page.url.pathname.startsWith(r))}
  {@render children()}
{:else}
  <h1>List arms</h1>
  {@render children()}
{/if}
