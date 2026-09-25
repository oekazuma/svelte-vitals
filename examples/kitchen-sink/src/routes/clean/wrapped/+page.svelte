<script lang="ts">
  import JsonLd from '$lib/clean/jsonld/WrappedPage.svelte';
</script>

<svelte:head>
  <title>Wrapped layout canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A page its layout wraps in an error-boundary component, whose failed screen has its own heading that replaces the page's."
  />
  <link rel="canonical" href="https://example.com/clean/wrapped" />
  <meta property="og:title" content="Wrapped layout canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page its layout wraps in an error-boundary component, whose failed screen has its own heading that replaces the page's."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/wrapped" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<h1>Wrapped layout canary</h1>
<p>The layout renders this page through an error-boundary component, which shows its own screen if rendering fails.</p>
