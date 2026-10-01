<!-- Its label renders only where a use passes `title`, so two toggles on a page share the id only when both do. -->
<script lang="ts">
  let { title = '' }: { title?: string } = $props();
</script>

{#if title !== ''}
  <span id="toggle-label">{title}</span>
{/if}
<button type="button">Toggle</button>
