import { linkRule } from './link-rule.js';

export const perf003PreloadAs = linkRule({
  id: 'PERF003',
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

export const perf004FontPreloadCrossorigin = linkRule({
  id: 'PERF004',
  title: 'Font preload missing crossorigin',
  severity: 'warning',
  label: '`crossorigin` on a font preload',
  recommendation:
    'Add `crossorigin` to `<link rel="preload" as="font">` — fonts are fetched in CORS mode, so without it the preload fetches a second, unused copy.',
  rationale:
    'A font preload without `crossorigin` does not match the actual (CORS) font request, so the preloaded file is never used and the font downloads twice.',
  fix: {
    description: 'Add the `crossorigin` attribute to the font preload link.',
    snippet: '<link rel="preload" href="/inter.woff2" as="font" type="font/woff2" crossorigin />',
    lang: 'html'
  },
  relevant: (t) => t.rel === 'preload' && t.as === 'font',
  ok: (t) => t.hasCrossorigin === true
});
