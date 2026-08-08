import type { HeadTag } from '../../head.js';
import { headTagRule } from './head-tag-rule.js';

export const seoCanonicalUrl = headTagRule({
  id: 'seo/canonical-url',
  title: 'Canonical URL',
  severity: 'warning',
  match: (t: HeadTag) => t.kind === 'link' && t.rel === 'canonical',
  label: '<link rel="canonical">',
  recommendation: 'Add <link rel="canonical"> in <svelte:head>, or set the canonical prop on your meta component.',
  rationale:
    'A canonical URL tells search engines which URL is authoritative, preventing duplicate-content dilution across query-string variants of the same page.',
  fix: {
    description: 'Add <link rel="canonical"> inside <svelte:head>, or set the canonical prop on your meta component.',
    snippet: '<svelte:head>\n  <link rel="canonical" href="https://example.com/this-page" />\n</svelte:head>',
    lang: 'svelte'
  }
});
