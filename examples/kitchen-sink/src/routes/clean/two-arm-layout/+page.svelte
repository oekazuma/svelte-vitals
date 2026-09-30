<script lang="ts">
  import JsonLd from '$lib/clean/jsonld/TwoArmLayoutPage.svelte';
</script>

<svelte:head>
  <title>Two-arm layout canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A page its layout renders in two arms of one block, never beside the arm that shows its own heading."
  />
  <link rel="canonical" href="https://example.com/clean/two-arm-layout" />
  <meta property="og:title" content="Two-arm layout canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page its layout renders in two arms of one block, never beside the arm that shows its own heading."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/two-arm-layout" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<h1>Two-arm layout canary</h1>
<p id="access-reason">The page explains access in its own words.</p>
