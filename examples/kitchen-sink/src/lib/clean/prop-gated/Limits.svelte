<!-- Each use passes a different section, so each section's field renders once. -->
<script lang="ts">
  let { section = 'spend' }: { section?: 'spend' | 'authority' | 'computer' } = $props();
  let editing = $state(false);
</script>

{#if editing}
  <p>Saving…</p>
{:else if section === 'spend'}
  <input id="limits-spend" aria-label="Spend" />
{:else if section === 'authority' && !editing}
  <input id="limits-authority" aria-label="Authority" />
{:else if section === 'computer' && !editing}
  <input id="limits-computer" aria-label="Computer" />
{/if}
<button type="button" onclick={() => (editing = !editing)}>Edit {section}</button>
