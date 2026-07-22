import { linkRule } from './link-rule.js';

export const performanceFontPreloadCrossorigin = linkRule({
  id: 'performance/font-preload-crossorigin',
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
