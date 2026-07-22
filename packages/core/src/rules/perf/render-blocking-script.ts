import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const docsUrl = docsUrlFor('performance/render-blocking-script');
const recommendation = 'Add defer (or type="module"), or async, to the <script> so it does not block HTML parsing.';

/**
 * performance/render-blocking-script — Render-blocking <script> in <head>. A <script src> without
 * defer/async/type=module blocks the parser. SvelteKit's own scripts are
 * module/deferred, so this catches hand-added blocking scripts — in app.html
 * (rendered mode) or in <svelte:head> (static mode). A head with no <script>
 * emits nothing (no signal), like the image rules.
 */
export const performanceRenderBlockingScript: Rule = {
  id: 'performance/render-blocking-script',
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
      const scripts = head.tags.filter((t) => t.kind === 'script');
      if (scripts.length === 0) continue; // no <script> in head → no render-blocking signal
      const blocking = scripts.filter((t) => t.blocking);
      if (blocking.length > 0) {
        for (const tag of blocking) {
          out.push({
            id: 'performance/render-blocking-script',
            category: 'performance',
            severity: 'warning',
            detection: { presence: 'none', value: 'absent' },
            route: head.route,
            // location is a source path (the URL stays in the message), per the rule-engine convention.
            location: tag.file ?? head.file,
            message: `Render-blocking <script>${tag.href ? ` (${tag.href})` : ''} in <head>`,
            recommendation,
            docsUrl,
            fix: { ...(performanceRenderBlockingScript.fix as NonNullable<Rule['fix']>) }
          });
        }
      } else {
        out.push({
          id: 'performance/render-blocking-script',
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
