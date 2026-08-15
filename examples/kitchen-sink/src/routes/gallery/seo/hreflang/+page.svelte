<svelte:head>
  <title>hreflang validity defects</title>
  <meta name="description" content="A single hreflang alternate using a malformed language-region code." />
  <link rel="canonical" href="https://example.com/gallery/seo/hreflang" />
  <meta property="og:title" content="hreflang validity defects" />
  <meta property="og:description" content="A malformed hreflang code." />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/gallery/seo/hreflang" />
  <meta name="twitter:card" content="summary_large_image" />
  <!--
    Only one <link rel="alternate"> here (not the "malformed code + no x-default"
    pair the rule doc's two arms suggest): the composed head keeps only the LAST
    <link> per rel within a route (see the note on gallery/perf/+page.svelte), so a
    second alternate would silently vanish instead of adding a second defect.
  -->
  <link rel="alternate" hreflang="not-a-code" href="https://example.com/xx/gallery/seo/hreflang" />
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebPage", "name": "hreflang validity defects" }
  </script>
</svelte:head>

<h1>hreflang defects</h1>
<p>The one alternate uses a malformed <code>hreflang</code> code.</p>
