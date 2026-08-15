<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Load waterfall and sequential-await defects</title>
  <meta
    name="description"
    content="A universal load with one dependent await chain and one pair of needlessly sequential independent awaits."
  />
  <link rel="canonical" href="https://example.com/gallery/perf/loading" />
  <meta property="og:title" content="Load waterfall and sequential-await defects" />
  <meta property="og:description" content="A dependent chain plus needlessly sequential independent awaits." />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/gallery/perf/loading" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebPage", "name": "Load waterfall and sequential-await defects" }
  </script>

  <!-- performance/font-preload-crossorigin: as="font" without crossorigin -->
  <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" />
</svelte:head>

<h1>Load waterfall / sequential awaits</h1>
<p>User {data.user.name} has {data.posts.length} post(s). Theme: {data.config.theme}, views: {data.stats.views}.</p>
