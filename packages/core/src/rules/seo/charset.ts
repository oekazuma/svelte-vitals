import { headTagRule } from './head-tag-rule.js';

/**
 * seo/charset — Character encoding. The charset meta lives in `src/app.html`, so it is
 * only visible to rendered analysis (`appliesTo: rendered`), exactly like seo/viewport
 * (viewport). Static route analysis emits nothing instead of false-flagging it.
 */
export const seoCharset = headTagRule({
  id: 'seo/charset',
  title: 'Character encoding',
  severity: 'warning',
  match: (t) => t.kind === 'meta' && t.name === 'charset',
  label: '<meta charset>',
  appliesTo: (head) => head.source === 'rendered',
  recommendation: 'Add <meta charset="utf-8"> (usually the first line of <head> in src/app.html).',
  rationale:
    'Without a declared character encoding the browser must guess, which can render text as mojibake; <meta charset="utf-8"> is the standard declaration.',
  fix: {
    description: 'Add the charset meta tag (typically the first line of <head> in src/app.html).',
    snippet: '<meta charset="utf-8" />',
    lang: 'html'
  }
});
