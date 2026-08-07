import type { Category, Config, Result } from '../types.js';
import { computeScore, computeHealth, scoresByCategory, INVENTORY_FLOOR, type ScoreModel } from '../scoring/score.js';
import { buildInventory } from '../scoring/inventory.js';
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

/**
 * Per-rule counts. A rule present with `findings: 0` ran and reported nothing, and an absent rule was not
 * selected — but only when the caller supplied `ruleIds`. Without it the map is seeded from results alone,
 * so absence means "produced nothing" rather than "not selected".
 */
export interface RuleEvidence {
  findings: number;
  passed: number;
}

export interface JsonReport {
  version: string;
  score: number; // combined Health score
  weights: Partial<Record<Category, number>>;
  categories: Record<string, { score: number; scoreModel: ScoreModel; keys: number; affectedKeys: number }>;
  summary: Summary;
  rules: Record<string, RuleEvidence>;
  routes: Array<{ route: string; score: number; categories: Record<string, number>; issues: JsonIssue[] }>;
  siteIssues: JsonIssue[];
  /**
   * Floored severity weight per `"<category>::<scope>"` pair. Reproduces a `routes[].categories` entry
   * (`100 - 100 * failed / inventories[pair]`): a key is either a route id or a source file path, and
   * those two key spaces never overlap, so a category's results on one key always draw on a single scope.
   * It does not reproduce `routes[].score`: a route spanning more than one pair sums their *raw* weights
   * and floors that sum once, so adding this map's already-floored entries and re-dividing can disagree.
   */
  inventories: Record<string, number>;
  /**
   * Per-rule, per-declaration counts of places examined. Unlike `rules`, this describes the analysis
   * rather than the report: `--diff`, `--baseline` and suppressions do not narrow it. A rule that
   * counts nothing has no entry; a declaration that judged nothing has an entry of `0`.
   */
  examined?: Record<string, Record<string, number>>;
}

function ruleEvidence(
  results: Result[],
  config: Config,
  ruleIds: readonly string[] | undefined
): Record<string, RuleEvidence> {
  const out: Record<string, RuleEvidence> = {};
  // Seeding from the ran-rule list is what separates "ran and found nothing" from "never selected";
  // seeding from results alone would leave both empty.
  for (const id of ruleIds ?? []) out[id] = { findings: 0, passed: 0 };
  for (const r of results) {
    const entry = (out[r.id] ??= { findings: 0, passed: 0 });
    if (isPenalized(r.detection, config.treatDynamicAs)) entry.findings += 1;
    else entry.passed += 1;
  }
  return out;
}

/** Build the structured JSON report object (design §7). The shape the `json` reporter emits (issue #24). */
export function buildJsonReport(
  results: Result[],
  config: Config,
  meta: { version: string },
  ruleIds?: readonly string[],
  examined?: Record<string, Record<string, number>>
): JsonReport {
  const { health, categories: byCat, weights } = computeHealth(results, config);
  const summary = summarize(results, config);
  const rules = ruleEvidence(results, config, ruleIds);

  const categories = Object.fromEntries(
    Object.entries(byCat).map(([cat, sr]) => [
      cat,
      { score: sr.score, scoreModel: sr.scoreModel, keys: sr.keys, affectedKeys: sr.affectedKeys }
    ])
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
      // Per category, scored against that category's own inventory, so this is not guaranteed to average to
      // `score` — which is one ratio over the union of the pairs the route touched.
      categories: Object.fromEntries(
        Object.entries(scoresByCategory(rs, config, { applyCriticalCap: false })).map(([cat, sr]) => [cat, sr!.score])
      ),
      issues: rs
        .filter((r) => isPenalized(r.detection, config.treatDynamicAs))
        .map((r) => ({ ...issueOf(r), severity: effectiveSeverity(r, config) }))
    }));

  const siteIssues = results
    .filter((r) => r.route === undefined && isPenalized(r.detection, config.treatDynamicAs))
    .map((r) => ({ ...issueOf(r), severity: effectiveSeverity(r, config) }));

  const inventories = Object.fromEntries(
    [...buildInventory(config)].map(([pair, weight]) => [pair, Math.max(weight, INVENTORY_FLOOR)])
  );

  return {
    version: meta.version,
    score: health,
    weights,
    categories,
    summary,
    rules,
    routes,
    siteIssues,
    inventories,
    ...(examined && Object.keys(examined).length > 0 ? { examined } : {})
  };
}

/** Render results as the documented JSON report string (design §7). */
export function formatJsonReport(
  results: Result[],
  config: Config,
  meta: { version: string },
  ruleIds?: readonly string[],
  examined?: Record<string, Record<string, number>>
): string {
  return JSON.stringify(buildJsonReport(results, config, meta, ruleIds, examined), null, 2);
}
