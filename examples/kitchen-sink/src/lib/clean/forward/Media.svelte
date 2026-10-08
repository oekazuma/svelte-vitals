<script lang="ts">
  let { view }: { view: 'compact' | 'cozy' } = $props();
</script>

{#if view === 'cozy'}
  <h1>Embedded preview</h1>
{:else}
  <p>Preview hidden in compact view.</p>
{/if}
