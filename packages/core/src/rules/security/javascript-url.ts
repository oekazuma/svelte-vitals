import { componentRule } from '../component-rule.js';

export const securityJavascriptUrl = componentRule({
  id: 'security/javascript-url',
  title: 'javascript: URL',
  category: 'security',
  label: 'No javascript: URLs',
  recommendation: 'Use an event handler or a real URL instead of a javascript: URL.',
  rationale:
    'A javascript: URL in href/src/action/formaction breaks under a strict Content-Security-Policy and turns what should be a real navigation into inline script execution on activation — use an event handler on a <button> instead (the same shape is also a classic XSS vector, though detection here is literal-only, so every flagged URL is author-written, not injected).',
  applies: (c) => c.javascriptUrls.length > 0,
  bad: (c) => c.javascriptUrls.map((u) => ({ line: u.line, message: 'javascript: URL in an attribute' }))
});
