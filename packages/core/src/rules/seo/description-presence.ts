import type { HeadTag } from '../../head.js';
import { headTagRule } from './head-tag-rule.js';

export const seoDescriptionPresence = headTagRule({
  id: 'seo/description-presence',
  title: 'Description presence',
  severity: 'warning',
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
