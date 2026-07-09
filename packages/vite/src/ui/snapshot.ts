import { buildJsonReport, safeHref, type Config, type JsonReport } from '@svelte-vitals/core';
import type { FindingsStore, RouteBadge } from './store.js';

export interface DashboardSnapshot {
  report: JsonReport;
  badges: Record<string, RouteBadge>;
  analyzing: boolean;
  /** Monotonically increasing; lets the client discard an out-of-order /data.json response. */
  sequence: number;
  meta: { version: string; coreVersion?: string };
}

type Issue = JsonReport['routes'][number]['issues'][number];

/**
 * `docsUrl` on an ingested (live) result never goes through core's `escapeHtml`/`safeHref`
 * renderer in this dashboard — sanitize it once here, server-side, so the client never has
 * to re-implement the http(s)-only scheme check itself.
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

/** Build the payload shared by the dashboard shell's embedded JSON and the /data.json endpoint. */
export function buildSnapshot(
  store: FindingsStore,
  config: Config,
  meta: { version: string; coreVersion?: string }
): DashboardSnapshot {
  return {
    report: sanitizeReport(buildJsonReport(store.snapshot(), config, meta)),
    badges: store.badges(),
    analyzing: store.isAnalyzing(),
    sequence: store.sequence(),
    meta
  };
}
