import { imageRule } from './image-rule.js';

export const perf001ImageDimensions = imageRule({
  id: 'performance/image-dimensions',
  title: 'Image dimensions',
  severity: 'warning',
  label: '<img> width/height',
  recommendation: 'Set explicit width and height on <img> to reserve space and avoid layout shift (CLS).',
  rationale:
    'An <img> without explicit width and height triggers layout shift (CLS) as it loads, hurting Core Web Vitals and visual stability.',
  fix: {
    description: 'Add explicit width and height attributes to the <img>.',
    snippet: '<img src="/hero.jpg" width="1200" height="630" alt="…" />',
    lang: 'svelte'
  },
  ok: (img) => img.hasWidth && img.hasHeight
});
