import type { Config, Result } from '../types.js';
import { computeScore, scoresByCategory, type ScoreModel } from '../scoring/score.js';
import { summarize, effectiveSeverity, type Summary } from '../summary.js';
import { isPenalized } from '../rule.js';

function issueOf(result: Result) {
  return {
    id: result.id,
    category: result.category ?? 'seo',
    title: result.message,
    detection: result.detection,
    location: result.location,
    ...(result.line !== undefined ? { line: result.line } : {}),
    recommendation: result.recommendation,
    ...(result.docsUrl ? { docsUrl: result.docsUrl } : {}),
    ...(result.fix ? { fix: result.fix } : {})
  };
}

type JsonIssue = ReturnType<typeof issueOf> & { severity: ReturnType<typeof effectiveSeverity> };

export interface JsonReport {
  version: string;
  score: number;
  scoreModel: ScoreModel;
  categories: Record<string, { score: number; scoreModel: ScoreModel }>;
  summary: Summary;
  routes: Array<{ route: string; score: number; issues: JsonIssue[] }>;
  siteIssues: JsonIssue[];
}

/** Build the structured JSON report object (design §7). Shared by the json reporter and the MCP `analyze` tool (issue #24). */
export function buildJsonReport(results: Result[], config: Config, meta: { version: string }): JsonReport {
  // Top-level score = SEO subset for backward compat (existing consumers only see SEO).
  const seoResults = results.filter((r) => (r.category ?? 'seo') === 'seo');
  const { score, scoreModel } = computeScore(seoResults, config);
  const summary = summarize(results, config);

  const byCat = scoresByCategory(results, config);
  const categories = Object.fromEntries(
    Object.entries(byCat).map(([cat, sr]) => [cat, { score: sr.score, scoreModel: sr.scoreModel }])
  );

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
      score: computeScore(rs, config, { applyCriticalCap: false }).score,
      issues: rs
        .filter((r) => isPenalized(r.detection, config.treatDynamicAs))
        .map((r) => ({ ...issueOf(r), severity: effectiveSeverity(r, config) }))
    }));

  const siteIssues = results
    .filter((r) => r.route === undefined && isPenalized(r.detection, config.treatDynamicAs))
    .map((r) => ({ ...issueOf(r), severity: effectiveSeverity(r, config) }));

  return { version: meta.version, score, scoreModel, categories, summary, routes, siteIssues };
}

/** Render results as the documented JSON report string (design §7). */
export function formatJsonReport(results: Result[], config: Config, meta: { version: string }): string {
  return JSON.stringify(buildJsonReport(results, config, meta), null, 2);
}
