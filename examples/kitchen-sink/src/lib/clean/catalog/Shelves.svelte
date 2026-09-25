<!-- Unkeyed {#each} over constant lists: one from a runes module imported as `./state.svelte`,
     one its module also reads with `for…of`. -->
<script lang="ts">
  import { CATEGORIES, createFilter } from './state.svelte';
  import { SIZES, sizeLabels } from './sizes';

  const filter = createFilter();
</script>

<ul aria-label="Categories">
  {#each CATEGORIES as category}
    <li>
      <button type="button" aria-pressed={filter.active === category} onclick={() => (filter.active = category)}>
        {category}
      </button>
    </li>
  {/each}
</ul>

<ul aria-label="Sizes">
  {#each SIZES as size}
    <li>{sizeLabels[size]}</li>
  {/each}
</ul>
