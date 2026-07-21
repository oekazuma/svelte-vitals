import type { HeadTag } from '../../head.js';
import { headTagRule } from './head-tag-rule.js';

export const seo005OgTitle = headTagRule({
  id: 'seo/og-title',
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
