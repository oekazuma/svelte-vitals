<!-- The page renders in the first two arms, never beside the third arm's <h1> and id. -->
<script lang="ts">
  import { page } from '$app/state';

  let { children } = $props();
  let allowed = $state(true);
  const bare = $derived(page.url.pathname.endsWith('/bare'));
</script>

{#if bare}
  {@render children()}
{:else if allowed}
  <div class="frame">
    <button type="button" onclick={() => (allowed = false)}>Lock</button>
    {@render children()}
  </div>
{:else}
  <h1>No access</h1>
  <p id="access-reason">This area is locked.</p>
{/if}
