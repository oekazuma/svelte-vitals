import { headTagRule } from './head-tag-rule.js';

export const seoOgDescription = headTagRule({
  id: 'seo/og-description',
  title: 'Open Graph description',
  severity: 'warning',
  match: (t) => t.kind === 'meta' && t.property === 'og:description',
  label: '<meta property="og:description">',
  recommendation: 'Add <meta property="og:description">, or set openGraph.description on your meta component.',
  rationale:
    'og:description is the summary shown under the title in social previews; without it platforms guess or show nothing, lowering click-through.',
  fix: {
    description: 'Add an og:description meta tag in <svelte:head>.',
    snippet: '<svelte:head>\n  <meta property="og:description" content="A concise page summary." />\n</svelte:head>',
    lang: 'svelte'
  }
});
