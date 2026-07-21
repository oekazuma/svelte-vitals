import { headTagRule } from './head-tag-rule.js';

export const seo011TwitterCard = headTagRule({
  id: 'seo/twitter-card',
  title: 'Twitter Card',
  severity: 'info',
  match: (t) => t.kind === 'meta' && t.name === 'twitter:card',
  label: '<meta name="twitter:card">',
  recommendation: 'Add <meta name="twitter:card" content="summary_large_image"> so X/Twitter renders a rich card.',
  rationale:
    'twitter:card selects how the page renders when shared on X/Twitter; without it the platform falls back to a basic link (Open Graph tags are used as fallbacks for the rest).',
  fix: {
    description: 'Add a twitter:card meta tag in <svelte:head>.',
    snippet: '<svelte:head>\n  <meta name="twitter:card" content="summary_large_image" />\n</svelte:head>',
    lang: 'svelte'
  }
});
