import { imageRule } from './image-rule.js';

export const perf002ImageLoading = imageRule({
  id: 'performance/image-loading-hint',
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
