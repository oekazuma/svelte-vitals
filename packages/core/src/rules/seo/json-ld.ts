import type { HeadTag } from '../../head.js';
import { headTagRule } from './head-tag-rule.js';

export const seo008JsonLd = headTagRule({
  id: 'seo/json-ld',
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
