import { linkRule } from './link-rule.js';

export const perf003PreloadAs = linkRule({
  id: 'performance/preload-missing-as',
  title: 'Preload missing as',
  severity: 'warning',
  label: '`as` on a preloaded `<link>`',
  recommendation:
    'Add an `as` attribute to every `<link rel="preload">` so the browser knows the resource type and can prioritize it.',
  rationale:
    'A `<link rel="preload">` without an `as` attribute is ignored by the browser (or fetched a second time), wasting the preload.',
  fix: {
    description: 'Add an `as` attribute matching the resource type to the preload link.',
    snippet: '<link rel="preload" href="/app.css" as="style" />',
    lang: 'html'
  },
  relevant: (t) => t.rel === 'preload',
  ok: (t) => t.hasAs === true
});
