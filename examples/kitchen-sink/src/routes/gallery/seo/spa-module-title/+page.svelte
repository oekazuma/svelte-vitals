<script lang="ts">
  import { syncTitle } from '$lib/gallery/attention.svelte';

  let unread = $state(0);
  $effect(() => syncTitle(unread));
</script>

<svelte:head>
  <meta
    name="description"
    content="This route ships as a client-rendered SPA shell and sets its document title through a module function it calls."
  />
  <link rel="canonical" href="https://example.com/gallery/seo/spa-module-title" />
  <meta property="og:title" content="SPA route titled from a module" />
  <meta property="og:description" content="Client-rendered SPA shell titled through a module function." />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/gallery/seo/spa-module-title" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebPage", "name": "SPA route titled from a module" }
  </script>
</svelte:head>

<h1>SPA route titled from a module</h1>
<p>This route sets <code>ssr = false</code> and calls a function that writes <code>document.title</code>.</p>
<button type="button" onclick={() => (unread += 1)}>Add unread</button>
