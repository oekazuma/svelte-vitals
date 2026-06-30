import type { Category, Config, Result, Severity } from '../types.js';
import { classify, summarize, effectiveSeverity } from '../summary.js';
import { computeScore, computeHealth, type ScoreResult } from '../scoring/score.js';

const RULE = '────────────────────────';
const SEVERITY_TITLE: Record<Severity, string> = {
  critical: 'Critical',
  warning: 'Warnings',
  info: 'Info'
};

const CATEGORY_LABEL: Partial<Record<Category, string>> = {
  seo: 'SEO',
  performance: 'Performance',
  correctness: 'Correctness',
  security: 'Security',
  architecture: 'Architecture'
};
const CATEGORY_ORDER: Category[] = ['seo', 'performance', 'correctness', 'security', 'architecture'];

export interface ConsoleReportOptions {
  byRoute?: boolean;
  /** Mode label shown in the header (default 'static mode'). */
  mode?: string;
}

function scoreLine(label: string, { score, scoreModel }: ScoreResult): string {
  const parts = [`route avg ${scoreModel.routeAverage}`];
  if (scoreModel.sitePenalty > 0) parts.push(`site −${scoreModel.sitePenalty}`);
  if (scoreModel.criticalCap !== null) parts.push(`capped at ${scoreModel.criticalCap}: critical present`);
  return `${label} Score: ${score}/100   (${parts.join(' · ')})`;
}

function byRouteTree(results: Result[], config: Config): string[] {
  const routes = new Map<string, Result[]>();
  for (const r of results) {
    if (r.route === undefined) continue;
    if (!routes.has(r.route)) routes.set(r.route, []);
    routes.get(r.route)!.push(r);
  }
  const lines: string[] = ['By route', RULE];
  for (const [route, rs] of [...routes.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const { score } = computeScore(rs, config, { applyCriticalCap: false });
    lines.push(`${route.padEnd(28)} ${score}`);
    for (const r of rs.filter((x) => classify(x, config) === 'fail')) {
      lines.push(`    ✗ ${r.id}  ${r.message}`);
    }
  }
  lines.push('');
  return lines;
}

/**
 * Render results as a console report string (design §7). Pure: returns a string,
 * the caller is responsible for printing. Prepends a score header; when byRoute is
 * set, adds a per-route score tree.
 */
export function formatConsoleReport(results: Result[], config: Config, options: ConsoleReportOptions = {}): string {
  const summary = summarize(results, config);
  const { health, categories: byCat } = computeHealth(results, config);
  const present = CATEGORY_ORDER.filter((c) => byCat[c] !== undefined);
  const header: string[] = [`Svelte Vitals  ·  ${options.mode ?? 'static mode'}`, '', `Health: ${health}/100`];
  for (const c of present) {
    header.push(scoreLine(CATEGORY_LABEL[c] ?? c, byCat[c]!));
  }
  const lines: string[] = [...header, ''];

  const failures = results.filter((r) => classify(r, config) === 'fail');
  for (const severity of ['critical', 'warning', 'info'] as const) {
    const bucket = failures.filter((r) => effectiveSeverity(r, config) === severity);
    if (bucket.length === 0) continue;
    lines.push(`${SEVERITY_TITLE[severity]} (${bucket.length})`, RULE);
    for (const r of bucket) {
      lines.push(`✗ ${r.id}  ${r.message}`);
      if (r.route) lines.push(`            ${r.route}`);
      if (r.location) lines.push(`            ${r.location}${r.line ? `:${r.line}` : ''}`);
    }
    lines.push('');
  }

  const passed = results.filter((r) => classify(r, config) !== 'fail');
  if (passed.length > 0) {
    lines.push(`Passed (${passed.length})`, RULE);
    for (const r of passed) {
      const marker = classify(r, config) === 'dynamic' ? '  ↯ dynamic' : '';
      const route = r.route ? `  ${r.route}` : '';
      lines.push(`✓ ${r.id}  ${r.message}${marker}${route}`);
    }
    lines.push('');
  }

  if (options.byRoute) lines.push(...byRouteTree(results, config));
  if (summary.dynamic > 0) lines.push('↯ = set dynamically (verified at runtime).');

  return lines.join('\n').replace(/\n+$/, '\n');
}
