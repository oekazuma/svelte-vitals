<script>
  const bio = '<p>We make small, useful things.</p>';
</script>

<svelte:head>
  <title>About | Demo Store — Who We Are and What We Make</title>
  <meta
    name="description"
    content="Demo Store is a two-person workshop making small, useful goods since 2019. Here's our story."
  />
  <link rel="canonical" href="https://example.com/about" />
  <meta property="og:title" content="About Demo Store — Who We Are and What We Make" />
  <meta
    property="og:description"
    content="Demo Store is a two-person workshop making small, useful goods since 2019. Here's our story."
  />
  <meta property="og:image" content="https://example.com/og-about.png" />
  <meta property="og:url" content="https://example.com/about" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      "name": "About Demo Store"
    }
  </script>
</svelte:head>

<h1>About</h1>
{@html bio}
<a href="javascript:window.scrollTo(0, 0)">Back to top</a>
