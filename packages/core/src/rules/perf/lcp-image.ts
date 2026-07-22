import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const docsUrl = docsUrlFor('performance/lcp-image');
const recommendation =
  'Remove loading="lazy" from the LCP/first image and consider fetchpriority="high" so it loads as early as possible.';

/**
 * performance/lcp-image — LCP image not lazy-loaded. Lazy-loading the largest contentful paint
 * image delays it. Analysis approximates the LCP as the first <img> in document
 * order for the route; if that image is loading="lazy", flag it. Runs in both
 * static (CLI) and rendered (vite) mode, since both providers collect <img>.
 */
export const performanceLcpImage: Rule = {
  id: 'performance/lcp-image',
  title: 'LCP image eager loading',
  category: 'performance',
  severity: 'warning',
  scope: 'route',
  rationale:
    'Lazy-loading the LCP (first/above-the-fold) image delays the largest paint and hurts Core Web Vitals. The first image is the best static proxy for the LCP candidate.',
  fix: {
    description: 'Remove loading="lazy" from the first/LCP image; consider fetchpriority="high".',
    snippet: '<img src="/hero.jpg" width="1200" height="630" fetchpriority="high" alt="…" />',
    lang: 'svelte'
  },
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const route of ctx.images ?? []) {
      const first = route.images[0];
      if (!first) continue; // no images → no LCP-image signal
      out.push(
        first.lazy
          ? {
              id: 'performance/lcp-image',
              category: 'performance',
              severity: 'warning',
              detection: { presence: 'none', value: 'absent' },
              route: route.route,
              location: first.file,
              ...(first.line > 0 ? { line: first.line } : {}),
              message: 'First image (likely LCP) is loading="lazy"',
              recommendation,
              docsUrl,
              fix: { ...(performanceLcpImage.fix as NonNullable<Rule['fix']>) }
            }
          : {
              id: 'performance/lcp-image',
              category: 'performance',
              severity: 'warning',
              detection: { presence: 'own', value: 'static' },
              route: route.route,
              message: 'LCP image eager loading',
              recommendation,
              docsUrl
            }
      );
    }
    return out;
  }
};
