<svelte:head>
  <title>JSON-LD structured data defect showcase</title>
  <meta
    name="description"
    content="One JSON-LD block per structured-data rule: invalid JSON, a deprecated type, a relative URL, placeholder text, a non-ISO date, and missing required properties."
  />
  <link rel="canonical" href="https://example.com/gallery/seo/jsonld" />
  <meta property="og:title" content="JSON-LD structured data defect showcase" />
  <meta property="og:description" content="Six JSON-LD blocks, one defect each." />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/gallery/seo/jsonld" />
  <meta name="twitter:card" content="summary_large_image" />

  <!-- seo/json-ld-validity: valid JSON, but missing @context — "invalid or
       incomplete" per the rule doc. (A syntax-broken specimen, e.g. a trailing
       comma, is valid JS object-literal syntax and the formatter "fixes" it
       back into valid JSON, silently defeating the specimen.) -->
  <script type="application/ld+json">
    { "name": "Broken JSON Example" }
  </script>

  <!-- seo/json-ld-deprecated-type: FAQPage's Google rich result was restricted -->
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "FAQPage", "name": "Deprecated Type Example" }
  </script>

  <!-- seo/json-ld-relative-url: "image" is a known URL key and must be absolute -->
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebPage", "name": "Relative URL Example", "image": "/logo.png" }
  </script>

  <!-- seo/json-ld-placeholder: unreplaced boilerplate text -->
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebPage", "name": "Your Company Name" }
  </script>

  <!-- seo/json-ld-date-format: not ISO-8601 -->
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Sample Article",
      "datePublished": "06/26/2026"
    }
  </script>

  <!-- seo/json-ld-required-props: Product needs a review, aggregateRating, or offers -->
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "Product", "name": "Basic Widget" }
  </script>
</svelte:head>

<h1>JSON-LD structured data defects</h1>
<p>Six &lt;script type="application/ld+json"&gt; blocks, one targeted defect each.</p>
