<!-- Its title renders only in the full size, which no use here asks for. -->
<script lang="ts">
  let { size = 'full' }: { size?: 'full' | 'compact' } = $props();
  const compact = $derived(size === 'compact');
</script>

{#if !compact}
  <span id="panel-title">Panel</span>
{/if}
<span class="panel">{size}</span>
