<!-- Each {#if} arm renders a different snippet's <h1>, so exactly one renders. -->
<script lang="ts">
  import JsonLd from '$lib/clean/jsonld/SnippetsPage.svelte';
  import ReadingList from '$lib/clean/snippets/ReadingList.svelte';

  let compact = $state(false);
</script>

<svelte:head>
  <title>Snippet headings canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A page whose heading comes from one of two snippets chosen by an if block, above a reading list with drag handles."
  />
  <link rel="canonical" href="https://example.com/clean/snippets" />
  <meta property="og:title" content="Snippet headings canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page whose heading comes from one of two snippets chosen by an if block, above a reading list with drag handles."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/snippets" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

{#snippet fullHeading()}
  <h1>Snippet headings canary</h1>
{/snippet}

{#snippet compactHeading()}
  <h1>Snippets</h1>
{/snippet}

{#if compact}
  {@render compactHeading()}
{:else}
  {@render fullHeading()}
{/if}

<button type="button" onclick={() => (compact = !compact)}>Toggle compact heading</button>

<ReadingList
  items={[
    { id: 'runes', title: 'Understanding runes' },
    { id: 'snippets', title: 'Snippets in depth' }
  ]}
/>
