import type { Config, Result } from '@svelte-vitals/core';
import { applySuppressions, SUPPRESSIONS_FILE, type SuppressionEntry } from 'svelte-vitals';

/**
 * Apply `svelte-vitals-suppressions.json` the way every plugin surface must: source-scan entries
 * only. A route-level entry (route starting with `/`) is written by the CLI against
 * `src/routes/…/+page.svelte`, while the build gate's rendered findings anchor to the built HTML
 * and the dashboard's live layer to the route itself — the gate could never match it, and the
 * dashboard's static layer would drop it only until the route was browsed and the live result
 * re-surfaced it. Skipping them everywhere keeps Health identical across surfaces; the caller
 * gets one line per fact to print. Stale entries are not counted: pruning stays with the CLI.
 */
export function applySourceSuppressions(results: Result[], entries: readonly SuppressionEntry[], config: Config) {
  const notices: string[] = [];
  const source = entries.filter((e) => !e.route?.startsWith('/'));
  const routeLevel = entries.length - source.length;
  const applied = applySuppressions(results, source, config);
  if (applied.suppressed > 0) notices.push(`${applied.suppressed} finding(s) suppressed by ${SUPPRESSIONS_FILE}.`);
  if (routeLevel > 0) {
    notices.push(
      `${routeLevel} route-level ${routeLevel === 1 ? 'entry does' : 'entries do'} not apply to the plugin (${SUPPRESSIONS_FILE}) — ` +
        'rendered route findings anchor to the built HTML; use `overrides` for those.'
    );
  }
  return { results: applied.results, notices };
}
