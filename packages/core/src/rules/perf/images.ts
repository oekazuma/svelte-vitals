import { imageRule } from './image-rule.js';

export const perf001ImageDimensions = imageRule({
  id: 'PERF001',
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

export const perf002ImageLoading = imageRule({
  id: 'PERF002',
  title: 'Image loading hint',
  severity: 'info',
  label: '<img> loading attribute',
  recommendation: 'Set loading="lazy" for offscreen images; keep the LCP image eager (consider fetchpriority="high").',
  rationale:
    'A loading attribute lets the browser defer offscreen images; without it images load eagerly and can delay more important content. Static analysis cannot tell which image is the LCP, so this is advisory.',
  fix: {
    description: 'Add loading="lazy" to offscreen <img> elements (leave the LCP/hero image eager).',
    snippet: '<img src="/thumb.jpg" width="320" height="240" loading="lazy" alt="…" />',
    lang: 'svelte'
  },
  ok: (img) => img.hasLoading
});
