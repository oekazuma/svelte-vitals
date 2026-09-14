<svelte:head>
  <title>Prerendered SPA shell with SSR disabled</title>
  <meta
    name="description"
    content="This route is prerendered with ssr = false, so its build output is the app shell and the page only exists after hydration."
  />
  <link rel="canonical" href="https://example.com/gallery/seo/spa-shell" />
  <meta property="og:title" content="Prerendered SPA shell with SSR disabled" />
  <meta property="og:description" content="Prerendered app shell, client-rendered page." />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/gallery/seo/spa-shell" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebPage", "name": "Prerendered SPA shell with SSR disabled" }
  </script>
</svelte:head>

<h1>Prerendered SPA shell</h1>
<p>This route sets <code>ssr = false</code> in its <code>+page.ts</code> and inherits <code>prerender = true</code>.</p>
