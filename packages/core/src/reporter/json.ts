import type { Config, Result } from '../types.js';
import { computeScore } from '../scoring/score.js';
import { summarize, effectiveSeverity } from '../summary.js';
import { isPenalized } from '../rule.js';

function issueOf(result: Result) {
  return {
    id: result.id,
    title: result.message,
    detection: result.detection,
    location: result.location,
    recommendation: result.recommendation
  };
}

/** Render results as the documented JSON report string (design §7). */
export function formatJsonReport(results: Result[], config: Config, meta: { version: string }): string {
  const { score, scoreModel } = computeScore(results, config);
  const summary = summarize(results, config);

  const routeMap = new Map<string, { route: string; results: Result[] }>();
  for (const r of results) {
    if (r.route === undefined) continue;
    if (!routeMap.has(r.route)) routeMap.set(r.route, { route: r.route, results: [] });
    routeMap.get(r.route)!.results.push(r);
  }

  const routes = [...routeMap.values()]
    .sort((a, b) => a.route.localeCompare(b.route))
    .map(({ route, results: rs }) => ({
      route,
      score: computeScore(rs, config).score,
      issues: rs
        .filter((r) => isPenalized(r.detection, config.treatDynamicAs))
        .map((r) => ({ ...issueOf(r), severity: effectiveSeverity(r, config) }))
    }));

  const siteIssues = results
    .filter((r) => r.route === undefined && isPenalized(r.detection, config.treatDynamicAs))
    .map((r) => ({ ...issueOf(r), severity: effectiveSeverity(r, config) }));

  return JSON.stringify({ version: meta.version, score, scoreModel, summary, routes, siteIssues }, null, 2);
}
