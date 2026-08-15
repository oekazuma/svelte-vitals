<svelte:head>
  <title>SSR disabled canary route</title>
  <meta
    name="description"
    content="This route ships as a client-rendered SPA shell — content is invisible to non-JS crawlers until JavaScript runs."
  />
  <link rel="canonical" href="https://example.com/gallery/seo/ssr-off" />
  <meta property="og:title" content="SSR disabled canary route" />
  <meta property="og:description" content="Client-rendered SPA shell." />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/gallery/seo/ssr-off" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebPage", "name": "SSR disabled canary route" }
  </script>
</svelte:head>

<h1>SSR disabled</h1>
<p>This route sets <code>ssr = false</code> and <code>prerender = false</code> in its <code>+page.ts</code>.</p>
