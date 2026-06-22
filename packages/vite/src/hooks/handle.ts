import type { Handle } from '@sveltejs/kit';
import {
  allRules,
  applyRuleSeverities,
  defineConfig,
  runRules,
  selectRules,
  type Config,
  type Project,
  type ResolvedHead,
  type Rule
} from '@svelte-vitals/core';
import { parseHtmlHead } from '../providers/rendered/parse-html.js';
import { findingSignature, formatDevReport } from './format.js';
import type { SvelteVitalsHookOptions } from './options.js';

async function analyzeAndWarn(
  html: string,
  route: string,
  rules: Rule[],
  config: Config,
  lastSignature: Map<string, string>
): Promise<void> {
  try {
    const { tags, htmlLang } = parseHtmlHead(html);
    const head: ResolvedHead = { route, source: 'rendered', tags, file: route };
    // robots/sitemap are not page-scoped, so mark them present to suppress SEO006/SEO007;
    // htmlLang comes from the rendered document so SEO009 is evaluated against reality.
    const project: Project = { hasRobotsTxt: true, hasSitemap: true, htmlLang };
    const results = applyRuleSeverities(await runRules(rules, { heads: [head], project, config }), config);

    const signature = findingSignature(results, config);
    if (lastSignature.get(route) === signature) return;
    lastSignature.set(route, signature);

    const report = formatDevReport(route, results, config);
    if (report) console.warn(report);
  } catch {
    // Dev tooling must never break the request: swallow any parse/rule error.
  }
}

/**
 * SvelteKit `handle` that prints SEO warnings for each visited page's rendered `<head>`,
 * in dev only. Add it to `src/hooks.server.ts`, e.g. `sequence(svelteVitalsHandle())`.
 */
export function svelteVitalsHandle(options: SvelteVitalsHookOptions = {}): Handle {
  const config = defineConfig({
    metaComponents: options.metaComponents ?? [],
    rules: options.rules ?? {},
    treatDynamicAs: 'pass',
    failOn: 'critical'
  });
  const rules = selectRules(allRules, config);
  const lastSignature = new Map<string, string>();

  return ({ event, resolve }) => {
    // Dev-only: run analysis only under a Node dev server. In production — and in
    // non-Node runtimes (edge adapters) where `process` is undefined — pass through
    // untouched. Guarding `typeof process` first avoids a ReferenceError that would
    // otherwise crash every request on edge deployments.
    if (typeof process === 'undefined' || process.env.NODE_ENV === 'production') return resolve(event);

    let buffer = '';
    return resolve(event, {
      transformPageChunk: async ({ html, done }) => {
        buffer += html;
        if (done) await analyzeAndWarn(buffer, event.route.id ?? event.url.pathname, rules, config, lastSignature);
        return html;
      }
    });
  };
}
