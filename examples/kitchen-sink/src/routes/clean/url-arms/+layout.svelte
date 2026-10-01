<script lang="ts">
  import { page } from '$app/state';

  let { children } = $props();
  const bare = $derived(page.url.pathname.endsWith('/bare'));
</script>

{#if bare}
  {@render children()}
{:else}
  <p id="section-note">The other pages of this section share a note.</p>
  {@render children()}
{/if}
