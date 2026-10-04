<!-- Reads its props without destructuring; the hint renders only where a use passes one, which none here does. -->
<script lang="ts">
  let props: { hint?: string } = $props();
</script>

{#if props.hint}
  <span id="hint-text">{props.hint}</span>
{/if}
