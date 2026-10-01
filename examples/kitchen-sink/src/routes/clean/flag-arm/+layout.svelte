<!-- The section is switched off by an imported flag that is the literal false: the page below never renders. -->
<script lang="ts">
  import { BETA_NOTES } from '$lib/clean/flags/features';

  let { children } = $props();
</script>

{#if !BETA_NOTES}
  <h1>Notes are coming soon</h1>
{:else}
  <article>{@render children()}</article>
{/if}
