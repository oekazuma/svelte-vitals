<!-- Its <h1> renders only where a page passes `isHome`; everywhere else the bar is a plain <p>. -->
<script lang="ts">
  let { isHome = false }: { isHome?: boolean } = $props();
</script>

{#if isHome}
  <h1>Kitchen sink</h1>
{:else}
  <p>Kitchen sink</p>
{/if}
