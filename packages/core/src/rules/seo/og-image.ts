import type { HeadTag } from '../../head.js';
import { headTagRule } from './head-tag-rule.js';

export const seoOgImage = headTagRule({
  id: 'seo/og-image',
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
