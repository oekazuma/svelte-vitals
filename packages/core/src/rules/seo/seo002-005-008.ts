import type { HeadTag } from '../../head.js';
import { headTagRule } from './head-tag-rule.js';

export const seo002Description = headTagRule({
  id: 'SEO002',
  title: 'Description presence',
  severity: 'critical',
  match: (t: HeadTag) => t.kind === 'meta' && t.name === 'description',
  label: '<meta name="description">',
  recommendation: 'Add a <meta name="description"> in <svelte:head>, or set the description on your meta component.',
  rationale:
    'A meta description is the snippet search engines show under your title; without one they invent one from page text, often poorly.',
  fix: {
    description: 'Add a <meta name="description"> inside <svelte:head>, or set description on your meta component.',
    snippet: '<svelte:head>\n  <meta name="description" content="A concise page summary." />\n</svelte:head>',
    lang: 'svelte'
  }
});

export const seo003Canonical = headTagRule({
  id: 'SEO003',
  title: 'Canonical URL',
  severity: 'warning',
  match: (t: HeadTag) => t.kind === 'link' && t.rel === 'canonical',
  label: '<link rel="canonical">',
  recommendation: 'Add <link rel="canonical"> in <svelte:head>, or set the canonical prop on your meta component.',
  rationale:
    'A canonical URL tells search engines which URL is authoritative, preventing duplicate-content dilution across query strings and trailing-slash variants.',
  fix: {
    description: 'Add <link rel="canonical"> inside <svelte:head>, or set the canonical prop on your meta component.',
    snippet: '<svelte:head>\n  <link rel="canonical" href="https://example.com/this-page" />\n</svelte:head>',
    lang: 'svelte'
  }
});

export const seo004OgImage = headTagRule({
  id: 'SEO004',
  title: 'Open Graph image',
  severity: 'warning',
  match: (t: HeadTag) => t.kind === 'meta' && t.property === 'og:image',
  label: '<meta property="og:image">',
  recommendation: 'Add <meta property="og:image">, or set openGraph.images on your meta component.',
  rationale:
    'og:image is the preview thumbnail shown when the page is shared on social platforms; without it links render bare and get fewer clicks.',
  fix: {
    description: 'Add <meta property="og:image">, or set openGraph.images on your meta component.',
    snippet: '<svelte:head>\n  <meta property="og:image" content="https://example.com/og.png" />\n</svelte:head>',
    lang: 'svelte'
  }
});

export const seo005OgTitle = headTagRule({
  id: 'SEO005',
  title: 'Open Graph title',
  severity: 'warning',
  match: (t: HeadTag) => t.kind === 'meta' && t.property === 'og:title',
  label: '<meta property="og:title">',
  recommendation: 'Add <meta property="og:title">, or set openGraph.title on your meta component.',
  rationale:
    'og:title controls the headline shown when the page is shared on social platforms, independent of the document <title>.',
  fix: {
    description: 'Add <meta property="og:title">, or set openGraph.title on your meta component.',
    snippet: '<svelte:head>\n  <meta property="og:title" content="Page title" />\n</svelte:head>',
    lang: 'svelte'
  }
});

export const seo008JsonLd = headTagRule({
  id: 'SEO008',
  title: 'JSON-LD structured data',
  severity: 'info',
  match: (t: HeadTag) => t.kind === 'jsonld',
  label: 'JSON-LD (<script type="application/ld+json">)',
  recommendation: 'Add JSON-LD structured data, e.g. via <svelte:head> or a JsonLd component.',
  rationale:
    'JSON-LD structured data lets search engines render rich results (breadcrumbs, articles, products) for the page.',
  fix: {
    // Svelte ships <script> contents verbatim (the body is raw text, not Svelte
    // markup), so use literal JSON here — an interpolation like {JSON.stringify(...)}
    // would be emitted as that literal string and produce invalid JSON-LD.
    description: 'Add a JSON-LD <script> inside <svelte:head> with literal JSON (Svelte emits the script body as-is).',
    snippet:
      '<svelte:head>\n' +
      '  <script type="application/ld+json">\n' +
      '    {\n' +
      '      "@context": "https://schema.org",\n' +
      '      "@type": "WebPage",\n' +
      '      "name": "Page title"\n' +
      '    }\n' +
      '  </script>\n' +
      '</svelte:head>',
    lang: 'svelte'
  }
});
