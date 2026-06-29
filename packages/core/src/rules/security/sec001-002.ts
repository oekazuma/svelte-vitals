import { componentRule } from '../component-rule.js';

export const sec001Html = componentRule({
  id: 'SEC001',
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

export const sec002JavascriptUrl = componentRule({
  id: 'SEC002',
  title: 'javascript: URL',
  category: 'security',
  label: 'No javascript: URLs',
  recommendation: 'Use an event handler or a real URL instead of a javascript: URL.',
  rationale:
    'A javascript: URL in href/src/action executes arbitrary script on activation — an XSS / unsafe-navigation vector that also breaks under a strict Content-Security-Policy.',
  applies: (c) => c.javascriptUrls.length > 0,
  bad: (c) => c.javascriptUrls.map((u) => ({ line: u.line, message: 'javascript: URL in an attribute' }))
});
