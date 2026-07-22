import { headTagRule } from './head-tag-rule.js';

export const seoViewport = headTagRule({
  id: 'seo/viewport',
  title: 'Viewport',
  severity: 'warning',
  match: (t) => t.kind === 'meta' && t.name === 'viewport',
  label: '<meta name="viewport">',
  // Viewport canonically lives in app.html, which static (CLI) mode does not
  // resolve into head tags — only evaluate rendered heads so the rule stays
  // silent there instead of false-flagging "missing" on every route.
  appliesTo: (head) => head.source === 'rendered',
  recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> (usually in app.html).',
  rationale:
    'Without a viewport meta tag the page is not mobile-responsive, which Google penalizes under mobile-first indexing.',
  fix: {
    description: 'Add the viewport meta tag (typically in src/app.html <head>).',
    snippet: '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    lang: 'html'
  }
});
