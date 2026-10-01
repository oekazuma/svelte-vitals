<!-- Never rendered (see the layout): its second <main> and skipped heading level must not be reported. -->
<script lang="ts">
  import JsonLd from '$lib/clean/jsonld/FlagArmPage.svelte';
</script>

<svelte:head>
  <title>Flag-decided layout arm canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A page whose layout renders it only behind a feature flag that is switched off in source."
  />
  <link rel="canonical" href="https://example.com/clean/flag-arm" />
  <meta property="og:title" content="Flag-decided layout arm canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page whose layout renders it only behind a feature flag that is switched off in source."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/flag-arm" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<h1>Notes</h1>
<main>
  <h3>Recent</h3>
</main>
