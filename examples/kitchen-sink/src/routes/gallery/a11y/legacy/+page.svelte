<svelte:head>
  <title>Gallery: legacy markup — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="Obsolete elements and deprecated attributes planted for a11y/deprecated-element and a11y/deprecated-attr, with their conforming neighbours kept silent."
  />
  <link rel="canonical" href="https://example.com/gallery/a11y/legacy" />
  <meta property="og:title" content="Gallery: legacy markup — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="Obsolete elements and deprecated attributes planted for a11y/deprecated-element and a11y/deprecated-attr, with their conforming neighbours kept silent."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/gallery/a11y/legacy" />
  <meta name="twitter:card" content="summary_large_image" />
  <!-- a11y/deprecated-attr: <style type> here is an element (a component's own <style> block is the
       stylesheet, not an element, and is out of reach). -->
  <style type="text/css">
    .legacy {
      color: inherit;
    }
  </style>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Gallery: legacy markup",
      "url": "https://example.com/gallery/a11y/legacy"
    }
  </script>
</svelte:head>

<h1>Gallery — obsolete elements and deprecated attributes</h1>

<!-- a11y/deprecated-element: <strike> is in WHATWG's obsolete-features list; <s> is its replacement
     and must not fire. a11y/permitted-contents also reports it (info): an obsolete element is in
     no content category, so it fails <p>'s phrasing model. -->
<p><strike>old price</strike> <s>also old, conforming</s></p>

<!-- a11y/deprecated-element: <font> fires once as an element; its `color` must NOT also fire under
     a11y/deprecated-attr (one finding per element — data-level skip). -->
<font color="red">styled with a presentational element</font>

<!-- a11y/deprecated-attr: `width` is deprecated on <td> but current on <img> — the same name must
     fire on one and not the other. -->
<table>
  <tbody>
    <tr><td width="120">sized with an attribute</td></tr>
  </tbody>
</table>
<img
  src="/img/example.jpg"
  srcset="/img/example.jpg 1x"
  width="120"
  height="80"
  loading="eager"
  alt="A conforming width attribute on img"
/>

<!-- a11y/deprecated-attr: `frameborder` — the most common deprecated attribute in real apps. -->
<iframe src="/clean" frameborder="0" title="Embedded page"></iframe>

<!-- Neither rule: <style type> inside <svg> is the SVG element. -->
<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
  <style type="text/css">
    .dot {
      fill: currentColor;
    }
  </style>
  <circle class="dot" cx="12" cy="12" r="6" />
</svg>
<!-- a11y/deprecated-element: <marquee> is reported here and by the compiler — the deliberate overlap
     that keeps the score honest. Its `behavior` attribute is not a second finding. -->
<marquee behavior="scroll">reported by both the compiler and svelte-vitals</marquee>
