import { componentRule } from '../component-rule.js';

/** Any literal `loading` value passes (the author made a choice); an expression value is
 *  unknowable and passes; a spread could supply `loading` and passes. */
export const performanceIframeLoading = componentRule({
  id: 'performance/iframe-loading',
  title: 'Iframe loading attribute',
  category: 'performance',
  severity: 'info',
  label: '<iframe> loading attribute',
  recommendation: 'If this iframe can be offscreen on load, add loading="lazy"; keep an above-the-fold iframe eager.',
  rationale:
    'An iframe without a loading attribute loads eagerly, and an offscreen iframe (embedded video player, map, ad slot) typically loads an entire third-party document — scripts, fonts, media — so its bandwidth and main-thread cost is usually larger than an offscreen image’s. loading="lazy" defers it until the viewport approaches. Static analysis cannot tell whether the iframe is above the fold, so this is advisory.',
  fix: {
    description: 'Add loading="lazy" to iframes that can be offscreen on load.',
    snippet: '<iframe src="https://example.com/embed" title="…" loading="lazy"></iframe>',
    lang: 'svelte'
  },
  applies: (c) => (c.elements ?? []).some((e) => !e.inSvg && e.tag === 'iframe'),
  bad: (c) =>
    (c.elements ?? [])
      .filter((e) => !e.inSvg && e.tag === 'iframe' && !e.hasSpread && !e.attrs.some((a) => a.name === 'loading'))
      .map((e) => ({
        line: e.line,
        message: '<iframe> without a loading attribute loads eagerly even when offscreen'
      }))
});
