<!-- The <h1> comes through a kit.alias whose value is built with fileURLToPath(new URL(…)), not a string literal. -->
<script lang="ts">
  import PageHeading from '$clean-real-world/PageHeading.svelte';

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Clean canary: computed kit.alias',
    url: 'https://example.com/clean/alias'
  };
</script>

<svelte:head>
  <title>Computed alias canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A page whose heading arrives through a computed kit.alias and whose card and JSON-LD use less common spellings."
  />
  <link rel="canonical" href="https://example.com/clean/alias" />
  <meta property="og:title" content="Computed alias canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page whose heading arrives through a computed kit.alias and whose card and JSON-LD use less common spellings."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/alias" />
  <meta property="twitter:card" content="summary_large_image" />
  <svelte:element this={"script"} type="application/ld+json">{JSON.stringify(ld)}</svelte:element>
</svelte:head>

<PageHeading>Computed alias canary</PageHeading>
<p>The heading above is rendered by a component imported as <code>$clean-real-world/…</code>.</p>
