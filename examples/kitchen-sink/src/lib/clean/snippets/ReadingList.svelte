<script lang="ts">
  import { dragHandle } from './drag-handle';
  import { readingPrefs } from './prefs.svelte';

  let { items }: { items?: { id: string; title: string }[] } = $props();

  const prefs = readingPrefs;
  let listEnd = $state<HTMLElement>();

  let reduceMotion = false;
  if (typeof matchMedia === 'function') reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  $effect(() => {
    document.documentElement.style.fontSize = `${prefs.fontSize}px`;
  });

  function jumpToEnd() {
    listEnd?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }
</script>

<h2>Reading list</h2>
<button type="button" onclick={() => prefs.larger()}>Larger text</button>
<button type="button" onclick={jumpToEnd}>Jump to end</button>

<ul>
  {#if items}
    {#each items as item (item.id)}
      <li>
        <span aria-label="Drag {item.title} to reorder" use:dragHandle>⋮⋮</span>
        {item.title}
      </li>
    {/each}
  {:else}
    {#each Array.from(new Array(3)) as _}
      <li>Loading…</li>
    {/each}
  {/if}
</ul>
<p bind:this={listEnd}>End of list.</p>
