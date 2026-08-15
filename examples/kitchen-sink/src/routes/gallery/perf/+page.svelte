<script lang="ts">
  // performance/namespace-import: `@sveltejs/kit` is a real, already-installed
  // dependency, so this namespace import is safe to keep on a real route (it
  // resolves fine in `vite build`) — unlike the heavy-import specimen, which
  // needs an uninstalled specifier and lives in a never-imported file instead.
  import * as kit from '@sveltejs/kit';
  const kitErrorType = typeof kit.error;

  // performance/state-raw: reassigned wholesale on refresh, never mutated in place.
  let items = $state<string[]>([]);

  async function refresh() {
    items = await fetch('/data/stats.json').then((r) => r.json());
  }
</script>

<svelte:head>
  <title>Performance defect gallery</title>
  <meta
    name="description"
    content="Every performance rule's failing shape in one route: images, preloads, a render-blocking script, and a namespace import."
  />
  <link rel="canonical" href="https://example.com/gallery/perf" />
  <meta property="og:title" content="Performance defect gallery" />
  <meta property="og:description" content="Images, preloads, a render-blocking script, a namespace import." />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/gallery/perf" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebPage", "name": "Performance defect gallery" }
  </script>

  <!-- performance/render-blocking-script: no defer/async/type="module" -->
  <script src="/analytics.js"></script>

  <!-- performance/preload-missing-as: no as attribute. (The font-preload-crossorigin
       specimen lives on gallery/perf/loading instead: the composed head keeps only
       the LAST <link> per rel within one route — packages/cli/src/providers/source/routes.ts
       composed.set(tagKey(tag), ...) collapses same-rel links — so two <link rel="preload">
       tags on one route would silently drop the first.) -->
  <link rel="preload" href="/app.css" />

  <!-- performance/preconnect: third-party origin referenced without a preconnect hint -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />
</svelte:head>

<h1>Performance defects</h1>

<!-- First image = LCP proxy: loading="lazy" trips performance/lcp-image;
     no srcset trips performance/responsive-image. -->
<img src="/img/hero.jpg" width="1200" height="630" loading="lazy" alt="Hero" />

<!-- Second image: missing width/height/loading trips performance/image-dimensions
     and performance/image-loading-hint. -->
<img src="/img/thumb.jpg" alt="Thumbnail" />

<ul>
  {#each items as item}
    <li>{item}</li>
  {/each}
</ul>
<button onclick={refresh}>Refresh</button>
<p>Namespace import typeof check: {kitErrorType}</p>
