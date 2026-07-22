import { componentRule } from '../component-rule.js';

export const securityRawHtml = componentRule({
  id: 'security/raw-html',
  title: 'Raw HTML render',
  category: 'security',
  label: '{@html} usage',
  recommendation: 'Sanitize the value before {@html} (e.g. DOMPurify), or render it as text/markup instead.',
  rationale:
    '{@html} renders its value as unescaped HTML; if the value can contain user input and is not sanitized, it is a cross-site-scripting (XSS) vector.',
  applies: (c) => c.htmlTags.length > 0,
  bad: (c) =>
    c.htmlTags.map((h) => ({ line: h.line, message: '{@html} renders unescaped HTML — ensure it is sanitized' }))
});
