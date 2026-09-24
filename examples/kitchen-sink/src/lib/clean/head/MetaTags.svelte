<script lang="ts">
  import JsonLd from '$lib/clean/jsonld/ResolutionPage.svelte';
</script>

<svelte:head>
  <meta
    name="description"
    content="A page whose head tags and heading arrive through a barrel, a namespace import and a runtime-chosen component."
  />
  <link rel="canonical" href="https://example.com/clean/resolution" />
  <meta property="og:title" content="Component resolution canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page whose head tags and heading arrive through a barrel, a namespace import and a runtime-chosen component."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/resolution" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />
