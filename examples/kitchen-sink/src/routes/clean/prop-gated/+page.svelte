<!-- <SiteBar> has an <h1> behind `isHome`, which this page does not pass, so the page's own <h1> is the only one. -->
<script lang="ts">
  import SiteBar from '$lib/clean/prop-gated/SiteBar.svelte';
  import JsonLd from '$lib/clean/jsonld/PropGatedPage.svelte';
</script>

<svelte:head>
  <title>Prop-gated heading canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A page whose shared bar renders its heading only on the home page, with JSON-LD in the body."
  />
  <link rel="canonical" href="https://example.com/clean/prop-gated" />
  <meta property="og:title" content="Prop-gated heading canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page whose shared bar renders its heading only on the home page, with JSON-LD in the body."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/prop-gated" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<SiteBar />
<JsonLd />

<h1>Prop-gated heading canary</h1>
<p>The bar above renders a paragraph here; its heading appears only on the home page.</p>
