import { DEV } from 'esm-env';
import type { Handle } from '@sveltejs/kit';
import {
  allRules,
  applyRuleSeverities,
  defineConfig,
  effectiveSeverity,
  formatFailedRuleWarning,
  isPenalized,
  runRules,
  selectRules,
  terminalSafe,
  type Config,
  type Project,
  type ResolvedA11y,
  type ResolvedHead,
  type ResolvedHeadings,
  type ResolvedImages,
  type Result,
  type Rule,
  type RuleSetting
} from '@svelte-vitals/core';
import { parseHtmlHead } from '../providers/rendered/parse-html.js';
import { toOccurrenceMap } from '../providers/rendered/collect.js';
import { isLoopbackOrigin } from '../loopback.js';

/** Options for the dev-time SvelteKit handle. A focused subset of the plugin options. */
export interface SvelteVitalsHookOptions {
  /** Component names treated as meta sources (design §11 layer 4). Mirrors the plugin option. */
  metaComponents?: string[];
  /** Per-rule overrides keyed by rule id, e.g. `{ 'seo/json-ld': 'off' }`. Mirrors the plugin option. */
  rules?: Record<string, RuleSetting>;
}

/** Stable signature of a route's penalized findings, so ingest is skipped when a repeat visit finds nothing new. */
export function findingSignature(results: Result[], config: Config): string {
  return results
    .filter((r) => isPenalized(r.detection, config.treatDynamicAs))
    .map((r) => `${r.id}:${effectiveSeverity(r, config)}:${r.detection.presence}:${r.detection.value}`)
    .sort()
    .join('|');
}

const warn = (line: string): void => console.warn(terminalSafe(line));

async function postIngest(origin: string, route: string, results: Result[], failedRuleIds: string[]): Promise<void> {
  // `origin` comes from the request (Host header), so a spoofed Host must not
  // redirect this server-side POST to an arbitrary external host.
  if (!isLoopbackOrigin(origin)) {
    // Accessing the app over LAN/--host yields a non-loopback origin, so the live
    // UI silently stops updating — surface why when debugging is enabled.
    if (globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
      warn(
        `[svelte-vitals] live UI ingest skipped for non-loopback origin ${origin} — open the dashboard via localhost`
      );
    }
    return;
  }
  try {
    await fetch(`${origin}/__svelte-vitals/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // failedRuleIds is always sent, empty array included, so a route that recovers from
      // a previously-crashing rule clears its stale entry on the receiving store.
      body: JSON.stringify({ route, results, failedRuleIds })
    });
  } catch {
    // dev tooling must never break a request — swallow ingest failures
  }
}

async function analyzeAndIngest(
  html: string,
  route: string,
  origin: string,
  rules: Rule[],
  config: Config,
  lastSignature: Map<string, string>
): Promise<void> {
  try {
    const {
      tags,
      htmlLang,
      headings: levels,
      images: imgs,
      landmarks,
      nestedLandmarks,
      ids,
      idRefs
    } = parseHtmlHead(html);
    const head: ResolvedHead = { route, source: 'rendered', tags, file: route };
    // Rendered mode does not track source lines (line 0 = unknown); file is the route.
    const headings: ResolvedHeadings[] = [
      { route, headings: levels.map((level) => ({ level, line: 0, file: route })) }
    ];
    const images: ResolvedImages[] = [{ route, images: imgs.map((img) => ({ ...img, file: route })) }];
    const a11y: ResolvedA11y[] = [
      {
        route,
        landmarks: toOccurrenceMap(landmarks, route),
        nestedLandmarks: nestedLandmarks.map((n) => ({ ...n, file: route, line: 0 })),
        ids: toOccurrenceMap(ids, route),
        idRefs: idRefs.map((r) => ({ ...r, file: route, line: 0 })),
        idCandidates: [...new Set(ids)],
        fullyResolved: true
      }
    ];
    // robots/sitemap are not page-scoped, so mark them present to suppress seo/robots-txt, seo/sitemap-xml;
    // htmlLang comes from the rendered document so seo/html-lang is evaluated against reality.
    const project: Project = { hasRobotsTxt: true, hasSitemap: true, htmlLang };
    // No JSON report is built here — results are POSTed to the dashboard ingest — so the
    // examined counts have nowhere to go and are dropped.
    const { results: ruleResults, failedRules } = await runRules(rules, {
      heads: [head],
      headings,
      images,
      a11y,
      project,
      config
    });
    const results = applyRuleSeverities(ruleResults, config);
    const failedRuleIds = failedRules.map((f) => f.id);

    // Same debug-only channel as this function's own catch below — a failed rule is dropped
    // silently otherwise, since this hot per-request path has no other diagnostics surface.
    if (failedRules.length > 0 && globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
      for (const f of failedRules) warn(formatFailedRuleWarning(f));
    }

    // Skip a repeat POST (and the SSE churn it would cause) when a route re-renders
    // with the exact same findings — e.g. an unrelated HMR pass. The failed-ids suffix
    // means a route that stops crashing (same findings, no more failures) still counts
    // as a change, so its recovery reaches the store instead of being signature-skipped.
    const signature = `${findingSignature(results, config)}|failed:${[...failedRuleIds].sort().join(',')}`;
    if (lastSignature.get(route) === signature) return;
    lastSignature.set(route, signature);

    if (globalThis.process?.env?.SVELTE_VITALS_UI) void postIngest(origin, route, results, failedRuleIds);
  } catch (err) {
    // Dev tooling must never break the request: swallow any parse/rule error.
    // Set SVELTE_VITALS_DEBUG to surface tool-internal errors while debugging.
    if (globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
      warn(`[svelte-vitals] dev analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/**
 * SvelteKit `handle` that analyzes each visited page's rendered `<head>`, in dev only,
 * and (when the live dashboard is enabled) feeds the results in — upgrading that
 * route's dashboard findings from static (source-only) to `measured` (real rendered
 * HTML). Add it to `src/hooks.server.ts`, e.g. `sequence(svelteVitalsHandle())`.
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
        // analysis. We fire-and-forget on the final chunk; analyzeAndIngest swallows
        // its own errors, so the floating promise can never reject.
        if (done)
          void analyzeAndIngest(
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
