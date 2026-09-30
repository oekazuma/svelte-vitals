<!-- Its load chains two awaits, but the layout's `csr = dev` ships no client runtime in production, so the chain only runs during SSR. -->
<script lang="ts">
  import JsonLd from '$lib/clean/jsonld/CsrDevPage.svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>Server-only feed canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A page whose load chains awaits under a layout that turns client-side rendering off in production builds."
  />
  <link rel="canonical" href="https://example.com/clean/csr-dev/feed" />
  <meta property="og:title" content="Server-only feed canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page whose load chains awaits under a layout that turns client-side rendering off in production builds."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/csr-dev/feed" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<h1>Server-only feed canary</h1>
<ul>
  {#each data.posts as post (post)}
    <li>{post}</li>
  {/each}
</ul>
