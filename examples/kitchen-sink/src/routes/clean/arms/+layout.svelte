<!-- The page renders only in the {:else} arm, so SignIn's <h1> and #email never render beside the page's. -->
<script lang="ts">
  import SignIn from '$lib/clean/arms/SignIn.svelte';

  let { data, children } = $props();
</script>

{#if !data.user}
  <SignIn />
{:else}
  {@render children()}
{/if}
