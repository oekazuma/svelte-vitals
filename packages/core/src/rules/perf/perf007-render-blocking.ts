import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const docsUrl = docsUrlFor('PERF007');
const recommendation = 'Add defer (or type="module"), or async, to the <script> so it does not block HTML parsing.';

/**
 * PERF007 — Render-blocking <script> in <head>. A <script src> without
 * defer/async/type=module blocks the parser. SvelteKit's own scripts are
 * module/deferred, so this catches hand-added blocking scripts (usually in
 * app.html) — hence rendered-only (static route heads emit nothing).
 */
export const perf007RenderBlockingScript: Rule = {
  id: 'PERF007',
  title: 'Render-blocking script',
  category: 'performance',
  severity: 'warning',
  scope: 'route',
  rationale:
    'A synchronous <script src> in <head> blocks HTML parsing until it downloads and runs, delaying first paint. defer, async, or type="module" avoids the block.',
  fix: {
    description: 'Add defer (or type="module") / async to the head <script>.',
    snippet: '<script src="/analytics.js" defer></script>',
    lang: 'html'
  },
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const head of ctx.heads) {
      if (head.source !== 'rendered') continue; // blocking scripts live in app.html → rendered-only
      const blocking = head.tags.filter((t) => t.kind === 'script' && t.blocking);
      if (blocking.length > 0) {
        for (const tag of blocking) {
          out.push({
            id: 'PERF007',
            category: 'performance',
            severity: 'warning',
            detection: { presence: 'none', value: 'absent' },
            route: head.route,
            location: tag.href ?? head.file,
            message: `Render-blocking <script>${tag.href ? ` (${tag.href})` : ''} in <head>`,
            recommendation,
            docsUrl,
            fix: { ...(perf007RenderBlockingScript.fix as NonNullable<Rule['fix']>) }
          });
        }
      } else {
        out.push({
          id: 'PERF007',
          category: 'performance',
          severity: 'warning',
          detection: { presence: 'own', value: 'static' },
          route: head.route,
          message: 'No render-blocking scripts',
          recommendation,
          docsUrl
        });
      }
    }
    return out;
  }
};
