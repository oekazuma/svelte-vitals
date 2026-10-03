<!-- Its hint renders only where a use passes both a warning tone and a hint, which no use here does. -->
<script lang="ts">
  let { tone = 'plain', hint = '' }: { tone?: 'plain' | 'warn'; hint?: string } = $props();
</script>

{#if tone === 'warn' && hint !== ''}
  <span id="badge-hint">{hint}</span>
{/if}
<span class="badge">{tone}</span>
