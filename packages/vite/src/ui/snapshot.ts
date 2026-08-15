import { type Config, type JsonReport } from '@svelte-vitals/core';
import { buildJsonReport, safeHref, withFailedRulesOff, type AppSnapshot } from '@svelte-vitals/core/internal';
import type { FindingsStore } from './store.js';

type Issue = JsonReport['routes'][number]['issues'][number];

/**
 * `docsUrl` on an ingested (live) result flows into `/data.json` responses, which the
 * client script renders into an <a href> without going through `renderAppShell`'s own
 * sanitizer — so sanitize here too, server-side, covering both the embedded first paint
 * and every refetch.
 */
function sanitizeDocsUrl(issue: Issue): Issue {
  if (issue.docsUrl === undefined) return issue;
  if (safeHref(issue.docsUrl) !== null) return issue;
  return { ...issue, docsUrl: undefined };
}

function sanitizeReport(report: JsonReport): JsonReport {
  return {
    ...report,
    routes: report.routes.map((route) => ({ ...route, issues: route.issues.map(sanitizeDocsUrl) })),
    siteIssues: report.siteIssues.map(sanitizeDocsUrl)
  };
}

/**
 * Build the payload shared by the dashboard shell's embedded JSON and the /data.json endpoint.
 * `config` is never swapped for another config — plugin-option `weights`/`overrides` must
 * survive every request. `staticFailedRuleIds` (the whole-project runner's crashed-rule ids)
 * and the store's live-layer union (`store.failedRuleIds()`) are both layered onto `config` via
 * `withFailedRulesOff`, the same correction the CLI and build mode apply, so a rule that crashed
 * on either layer scores as not-run instead of inflating Health.
 */
export function buildSnapshot(
  store: FindingsStore,
  config: Config,
  meta: { version: string; coreVersion?: string },
  staticFailedRuleIds?: string[]
): AppSnapshot {
  const failedRuleIds = [...new Set([...(staticFailedRuleIds ?? []), ...store.failedRuleIds()])];
  const scoringConfig = withFailedRulesOff(config, failedRuleIds);
  return {
    // No rule-id list threaded through: `report.rules` is seeded from `store.snapshot()`
    // alone here, so presence means "produced a result", not "was selected" — unlike the
    // `json` reporter (design doc 2026-08-03-json-rule-evidence-design.md, Not in scope).
    report: sanitizeReport(buildJsonReport(store.snapshot(), scoringConfig, meta)),
    badges: store.badges(),
    analyzing: store.isAnalyzing(),
    sequence: store.sequence(),
    live: true,
    meta
  };
}
