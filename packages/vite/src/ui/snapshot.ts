import {
  buildJsonReport,
  safeHref,
  withFailedRulesOff,
  type AppSnapshot,
  type Config,
  type JsonReport
} from '@svelte-vitals/core';
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
 * `staticConfig` is the whole-project runner's failure-adjusted config (crashed static rules
 * already forced `'off'`) — falls back to `config` before the first run completes. Live-layer
 * crashed rules (`store.failedRuleIds()`) are layered on top the same way the CLI and build mode
 * apply `withFailedRulesOff`, so a rule that crashed on either layer scores as not-run instead of
 * inflating Health.
 */
export function buildSnapshot(
  store: FindingsStore,
  config: Config,
  meta: { version: string; coreVersion?: string },
  staticConfig?: Config
): AppSnapshot {
  const scoringConfig = withFailedRulesOff(staticConfig ?? config, store.failedRuleIds());
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
