<!-- The page's only <h1> comes through a package.json `imports` entry (#clean/*), which must be followed like $lib. -->
<script lang="ts">
  import PageHeading from '#clean/real-world/PageHeading.svelte';
  import JsonLd from '#clean/jsonld/SubpathPage.svelte';
</script>

<svelte:head>
  <title>Subpath import canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A page whose heading and structured data arrive through a package.json subpath import, kept free of findings."
  />
  <link rel="canonical" href="https://example.com/clean/subpath" />
  <meta property="og:title" content="Subpath import canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page whose heading and structured data arrive through a package.json subpath import, kept free of findings."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/subpath" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<PageHeading>Subpath import canary</PageHeading>
<p>The heading above is rendered by a component imported as <code>#clean/…</code>.</p>
