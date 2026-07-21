import { componentRule } from '../component-rule.js';

export const sec002JavascriptUrl = componentRule({
  id: 'security/javascript-url',
  title: 'javascript: URL',
  category: 'security',
  label: 'No javascript: URLs',
  recommendation: 'Use an event handler or a real URL instead of a javascript: URL.',
  rationale:
    'A javascript: URL in href/src/action executes arbitrary script on activation — an XSS / unsafe-navigation vector that also breaks under a strict Content-Security-Policy.',
  applies: (c) => c.javascriptUrls.length > 0,
  bad: (c) => c.javascriptUrls.map((u) => ({ line: u.line, message: 'javascript: URL in an attribute' }))
});
