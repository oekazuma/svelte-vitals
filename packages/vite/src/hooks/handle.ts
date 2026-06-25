import { DEV } from 'esm-env';
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
  type Result,
  type Rule
} from '@svelte-vitals/core';
import { parseHtmlHead } from '../providers/rendered/parse-html.js';
import { findingSignature, formatDevReport } from './format.js';
import type { SvelteVitalsHookOptions } from './options.js';

/** Only the local dev server hosts the ingest endpoint, so never POST off-box. */
function isLoopbackOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  } catch {
    return false;
  }
}

async function postIngest(origin: string, route: string, results: Result[]): Promise<void> {
  // `origin` comes from the request (Host header), so a spoofed Host must not
  // redirect this server-side POST to an arbitrary external host.
  if (!isLoopbackOrigin(origin)) {
    // Accessing the app over LAN/--host yields a non-loopback origin, so the live
    // UI silently stops updating — surface why when debugging is enabled.
    if (globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
      console.warn(
        `[svelte-vitals] live UI ingest skipped for non-loopback origin ${origin} — open the dashboard via localhost`
      );
    }
    return;
  }
  try {
    await fetch(`${origin}/__svelte-vitals/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ route, results })
    });
  } catch {
    // dev tooling must never break a request — swallow ingest failures
  }
}

async function analyzeAndWarn(
  html: string,
  route: string,
  origin: string,
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
    if (globalThis.process?.env?.SVELTE_VITALS_UI) void postIngest(origin, route, results);
  } catch (err) {
    // Dev tooling must never break the request: swallow any parse/rule error.
    // Set SVELTE_VITALS_DEBUG to surface tool-internal errors while debugging.
    if (globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
      console.warn('[svelte-vitals] dev analysis failed:', err);
    }
  }
}

/**
 * SvelteKit `handle` that prints SEO warnings for each visited page's rendered `<head>`,
 * in dev only. Add it to `src/hooks.server.ts`, e.g. `sequence(svelteVitalsHandle())`.
 */
export function svelteVitalsHandle(options: SvelteVitalsHookOptions = {}): Handle {
  // Dev-only. `DEV` (esm-env) resolves statically to `true` under the dev server and
  // `false` in production builds; on non-Node runtimes (edge) its fallback reads no
  // bare `process`, so it stays `false`. Everywhere but dev this handle is a no-op,
  // and we skip building the rule set entirely.
  if (!DEV) return ({ event, resolve }) => resolve(event);

  // treatDynamicAs/failOn intentionally left at defaults: rendered HTML never yields
  // `dynamic` values (so treatDynamicAs is moot) and this handle reports rather than
  // gates (so failOn is unused).
  const config = defineConfig({
    metaComponents: options.metaComponents ?? [],
    rules: options.rules ?? {}
  });
  const rules = selectRules(allRules, config);
  const lastSignature = new Map<string, string>();

  return ({ event, resolve }) => {
    let buffer = '';
    return resolve(event, {
      transformPageChunk: ({ html, done }) => {
        buffer += html;
        // Observe-only: return the chunk unchanged and never block the response on
        // analysis. We fire-and-forget on the final chunk; analyzeAndWarn swallows
        // its own errors, so the floating promise can never reject.
        if (done)
          void analyzeAndWarn(
            buffer,
            event.route.id ?? event.url.pathname,
            event.url.origin,
            rules,
            config,
            lastSignature
          );
        return html;
      }
    });
  };
}
