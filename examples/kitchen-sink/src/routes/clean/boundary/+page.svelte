<!-- The description and card tags come from <Meta> rendered inside <svelte:head>; the failed <h1> replaces the page's. -->
<script lang="ts">
  import Meta from '$lib/clean/head/Meta.svelte';
  import JsonLd from '$lib/clean/jsonld/BoundaryPage.svelte';
</script>

<svelte:head>
  <title>Error boundary canary — svelte-vitals kitchen sink</title>
  <link rel="canonical" href="https://example.com/clean/boundary" />
  <Meta
    name="description"
    content="A page wrapped in an error boundary whose failed snippet has its own heading, with head tags from a component."
  />
  <Meta property="og:title" content="Error boundary canary — svelte-vitals kitchen sink" />
  <Meta
    property="og:description"
    content="A page wrapped in an error boundary whose failed snippet has its own heading, with head tags from a component."
  />
  <Meta property="og:image" content="https://example.com/og.png" />
  <Meta property="og:url" content="https://example.com/clean/boundary" />
  <Meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<svelte:boundary>
  <h1>Error boundary canary</h1>
  <p>If anything in here throws while rendering, the failed snippet takes the place of this content.</p>

  {#snippet failed(_error, reset)}
    <h1>Something went wrong</h1>
    <button type="button" onclick={reset}>Try again</button>
  {/snippet}
</svelte:boundary>
