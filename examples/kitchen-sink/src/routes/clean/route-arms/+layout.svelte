<!-- The section heading shows on the section's other routes only, never with this index page's own <h1>. -->
<script lang="ts">
  import { page } from '$app/state';

  let { children } = $props();
  const onIndex = $derived(['/clean/route-arms'].includes(page.route.id ?? ''));
</script>

{#if !onIndex}
  <h1>Route arms</h1>
{/if}
{@render children()}
