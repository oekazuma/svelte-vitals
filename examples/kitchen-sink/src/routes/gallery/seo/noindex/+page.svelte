<svelte:head>
  <title>Accidentally noindexed route</title>
  <meta
    name="description"
    content="A public-looking route whose robots meta statically resolves to noindex — the kind of accident seo/indexability exists to catch."
  />
  <link rel="canonical" href="https://example.com/gallery/seo/noindex" />
  <meta property="og:title" content="Accidentally noindexed route" />
  <meta property="og:description" content="Statically resolves to noindex." />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/gallery/seo/noindex" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="robots" content="noindex" />
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebPage", "name": "Accidentally noindexed route" }
  </script>
</svelte:head>

<h1>Noindex</h1>
<p>This route's robots meta statically resolves to <code>noindex</code>.</p>
