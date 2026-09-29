<!-- Its archive endpoint writes through a database client, not to module state the server shares. -->
<script lang="ts">
  import JsonLd from '$lib/clean/jsonld/DbWritePage.svelte';
</script>

<svelte:head>
  <title>Database write canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A kitchen-sink page whose archive endpoint archives rows through a database client instead of writing to shared module state."
  />
  <link rel="canonical" href="https://example.com/clean/db-write" />
  <meta property="og:title" content="Database write canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A kitchen-sink page whose archive endpoint archives rows through a database client instead of writing to shared module state."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/db-write" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<h1>Database write canary</h1>
<form method="POST" action="/clean/db-write/archive"><button type="submit">Archive</button></form>
