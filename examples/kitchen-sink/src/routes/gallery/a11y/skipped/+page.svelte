<script lang="ts">
  const attrs = { 'data-origin': 'spread' };
  const dynId = 'runtime-id';
</script>

<svelte:head>
  <title>Gallery — a11y skip visibility · svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A route whose closed world fails: static analysis skips a11y/no-missing-id-ref here and says so in the report."
  />
  <link rel="canonical" href="https://example.com/gallery/a11y/skipped" />
  <meta property="og:title" content="Gallery — a11y skip visibility · svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A route whose closed world fails: static analysis skips a11y/no-missing-id-ref here and says so in the report."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/gallery/a11y/skipped" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Gallery — a11y skip visibility",
      "url": "https://example.com/gallery/a11y/skipped"
    }
  </script>
</svelte:head>

<h1>Gallery — a11y skip visibility</h1>

<!-- a11y/no-missing-id-ref (static mode): the spread and the dynamic id below clear this route's
     closed world, so the rule skips it — the skip, with both causes, must appear in the JSON
     report's `skipped`. Rendered mode has no such gate: the prerendered document is closed, so
     this dangling `for` is a rendered finding (expected-findings.rendered.json). -->
<label for="phantom-input">Phantom label</label>
<div {...attrs}>Spread poisons the closed world.</div>
<span id={dynId}>So does a dynamic id.</span>
