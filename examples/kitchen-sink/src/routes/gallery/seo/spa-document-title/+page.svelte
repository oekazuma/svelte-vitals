<script lang="ts">
  import { onMount } from 'svelte';

  onMount(() => {
    document.title = 'SPA route titled from the browser';
  });
</script>

<svelte:head>
  <meta
    name="description"
    content="This route ships as a client-rendered SPA shell and sets its document title in the browser once it mounts."
  />
  <link rel="canonical" href="https://example.com/gallery/seo/spa-document-title" />
  <meta property="og:title" content="SPA route titled from the browser" />
  <meta property="og:description" content="Client-rendered SPA shell titled through document.title." />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/gallery/seo/spa-document-title" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebPage", "name": "SPA route titled from the browser" }
  </script>
</svelte:head>

<h1>SPA route titled from the browser</h1>
<p>This route sets <code>ssr = false</code> and writes <code>document.title</code> once it mounts.</p>
