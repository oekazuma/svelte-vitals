import { DEV } from 'esm-env';
import type { Handle } from '@sveltejs/kit';
import { defineConfig, type Config, type Result, type RuleSetting } from '@svelte-vitals/core';
import {
  allRules,
  defaultProject,
  effectiveSeverity,
  formatFailedRuleWarning,
  isPenalized,
  runAnalysis,
  selectRules,
  terminalSafe,
  type ResolvedA11y,
  type ResolvedHead,
  type ResolvedHeadings,
  type ResolvedImages,
  type Rule
} from '@svelte-vitals/core/internal';
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

/** True only when the dashboard acknowledged the POST — the caller records the route's signature on that, so a lost ingest is retried on the next render instead of pinning the route to `static`. */
async function postIngest(origin: string, route: string, results: Result[], failedRuleIds: string[]): Promise<boolean> {
  // `origin` comes from the request (Host header), so a spoofed Host must not
  // redirect this server-side POST to an arbitrary external host.
  if (!isLoopbackOrigin(origin)) {
    // Accessing the app over LAN/--host yields a non-loopback origin, so the live
    // UI silently stops updating — surface why when debugging is enabled.
    if (globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
      warn(
        `svelte-vitals: live UI ingest skipped for non-loopback origin ${origin} — open the dashboard via localhost`
      );
    }
    return false;
  }
  try {
    const res = await fetch(`${origin}/__svelte-vitals/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // failedRuleIds is always sent, empty array included, so a route that recovers from
      // a previously-crashing rule clears its stale entry on the receiving store.
      body: JSON.stringify({ route, results, failedRuleIds })
    });
    if (!res.ok && globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
      warn(`svelte-vitals: live UI ingest for ${route} rejected with HTTP ${res.status}`);
    }
    return res.ok;
  } catch (err) {
    // dev tooling must never break a request — swallow ingest failures
    if (globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
      warn(`svelte-vitals: live UI ingest for ${route} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return false;
  }
}

async function analyzeAndIngest(
  html: string,
  route: string,
  origin: string,
  rules: Rule[],
  config: Config,
  lastSignature: Map<string, string>,
  inflight: Map<string, Promise<void>>
): Promise<void> {
  try {
    const { tags, headings: levels, images: imgs, landmarks, nestedLandmarks, ids, idRefs } = parseHtmlHead(html);
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
    // No JSON report is built here — results are POSTed to the dashboard ingest — so the
    // examined counts have nowhere to go and are dropped. Dev has no config file, so no
    // overrides, and no source lines for directives to anchor to: the empty directive index
    // makes those correction passes identity, which is the explicit form of skipping them.
    const { results, failedRules, failedRuleIds } = await runAnalysis(
      rules,
      { heads: [head], headings, images, a11y, project: defaultProject, config },
      new Map()
    );

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

    if (!globalThis.process?.env?.SVELTE_VITALS_UI) return;
    // Per-route FIFO: two renders of one route are two unordered fetches otherwise, and the
    // store replaces last-write-wins, so an older payload could land last. The signature is
    // recorded only after the dashboard acknowledged the POST, so a lost ingest (dev server
    // restarting, a rejected origin, a transient socket error) is retried on the next render
    // instead of pinning the route to `static` for the rest of the session.
    const previous = inflight.get(route) ?? Promise.resolve();
    const next = previous.then(async () => {
      if (await postIngest(origin, route, results, failedRuleIds)) lastSignature.set(route, signature);
    });
    inflight.set(route, next);
    await next;
    if (inflight.get(route) === next) inflight.delete(route);
  } catch (err) {
    // Dev tooling must never break the request: swallow any parse/rule error.
    // Set SVELTE_VITALS_DEBUG to surface tool-internal errors while debugging.
    if (globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
      warn(`svelte-vitals: dev analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/**
 * SvelteKit `handle` that analyzes each visited page's rendered HTML, in dev only,
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
  // One route's rendered HTML can answer only the rules that judge a route on its own: a
  // cross-route rule passes on a single head and that pass replaces the static finding in the
  // dashboard's merge; a project-scope rule answers for the site from one page and the store files
  // that answer under the visited route, next to the real site-wide result.
  const rules = selectRules(allRules, config).filter((r) => r.scope === 'route' && !r.crossRoute);
  const lastSignature = new Map<string, string>();
  const inflight = new Map<string, Promise<void>>();

  return ({ event, resolve }) => {
    let buffer = '';
    return resolve(event, {
      transformPageChunk: ({ html, done }) => {
        buffer += html;
        // Observe-only: return the chunk unchanged and never block the response on
        // analysis. We fire-and-forget on the final chunk; analyzeAndIngest swallows
        // its own errors, so the floating promise can never reject.
        // Matched routes only: an unmatched request (404/error page) is not a route the
        // dashboard tracks, and raw pathnames would grow `lastSignature` without bound.
        if (done && event.route.id != null)
          void analyzeAndIngest(buffer, event.route.id, event.url.origin, rules, config, lastSignature, inflight);
        return html;
      }
    });
  };
}
