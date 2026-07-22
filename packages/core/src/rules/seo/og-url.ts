import { headTagRule } from './head-tag-rule.js';

export const seoOgUrl = headTagRule({
  id: 'seo/og-url',
  title: 'Open Graph URL',
  severity: 'info',
  match: (t) => t.kind === 'meta' && t.property === 'og:url',
  label: '<meta property="og:url">',
  recommendation: 'Add <meta property="og:url"> with the canonical URL, or set openGraph.url on your meta component.',
  rationale:
    'og:url tells social platforms the canonical address to attribute shares and likes to, consolidating engagement on one URL.',
  fix: {
    description: 'Add an og:url meta tag in <svelte:head>.',
    snippet: '<svelte:head>\n  <meta property="og:url" content="https://example.com/this-page" />\n</svelte:head>',
    lang: 'svelte'
  }
});
