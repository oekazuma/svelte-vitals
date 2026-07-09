import type { Category, Config, Result, Severity } from '../types.js';
import { classify, summarize, effectiveSeverity } from '../summary.js';
import { computeScore, computeHealth, type ScoreResult } from '../scoring/score.js';
import { noColorPalette, scoreColor, type Palette } from './palette.js';

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

const MAX_RULE_GROUPS_PER_BUCKET = 5;

interface RuleGroup {
  id: string;
  results: Result[];
}

/** Groups results by rule id, ranked by descending group size (most-affected rule first); ties broken by id for determinism. */
function groupByRule(results: Result[]): RuleGroup[] {
  const groups = new Map<string, Result[]>();
  for (const r of results) {
    const bucket = groups.get(r.id);
    if (bucket) bucket.push(r);
    else groups.set(r.id, [r]);
  }
  return [...groups.entries()]
    .map(([id, rs]) => ({ id, results: rs }))
    .sort((a, b) => b.results.length - a.results.length || a.id.localeCompare(b.id));
}

export interface ConsoleReportOptions {
  byRoute?: boolean;
  /** Mode label shown in the header (default 'static mode'). */
  mode?: string;
  /** Color decorators; defaults to no color. */
  palette?: Palette;
  /** Show every failing/passed/route entry uncapped and ungrouped, exactly as before this option existed. Default false (capped, grouped by rule). */
  verbose?: boolean;
}

function scoreLine(p: Palette, label: string, { score, scoreModel }: ScoreResult): string {
  const parts = [`route avg ${scoreModel.routeAverage}`];
  if (scoreModel.sitePenalty > 0) parts.push(`site −${scoreModel.sitePenalty}`);
  if (scoreModel.criticalCap !== null) parts.push(`capped at ${scoreModel.criticalCap}: critical present`);
  return `${label} Score: ${scoreColor(p, score)(`${score}/100`)}   ${p.dim(`(${parts.join(' · ')})`)}`;
}

function byRouteTree(p: Palette, results: Result[], config: Config): string[] {
  const routes = new Map<string, Result[]>();
  for (const r of results) {
    if (r.route === undefined) continue;
    if (!routes.has(r.route)) routes.set(r.route, []);
    routes.get(r.route)!.push(r);
  }
  const lines: string[] = [p.bold('By route'), p.dim(RULE)];
  for (const [route, rs] of [...routes.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const { score } = computeScore(rs, config, { applyCriticalCap: false });
    lines.push(`${route.padEnd(28)} ${scoreColor(p, score)(`${score}`)}`);
    for (const r of rs.filter((x) => classify(x, config) === 'fail')) {
      lines.push(`    ${p.red('✗')} ${r.id}  ${r.message}`);
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
  const p = options.palette ?? noColorPalette;
  const summary = summarize(results, config);
  const { health, categories: byCat } = computeHealth(results, config);
  const present = CATEGORY_ORDER.filter((c) => byCat[c] !== undefined);
  const header: string[] = [
    p.bold(`Svelte Vitals  ·  ${options.mode ?? 'static mode'}`),
    '',
    `${p.bold('Health:')} ${scoreColor(p, health)(`${health}/100`)}`
  ];
  for (const c of present) {
    header.push(scoreLine(p, CATEGORY_LABEL[c] ?? c, byCat[c]!));
  }
  const lines: string[] = [...header, ''];

  const SEVERITY_COLOR: Record<Severity, (s: string) => string> = {
    critical: (s) => p.red(p.bold(s)),
    warning: (s) => p.yellow(p.bold(s)),
    info: (s) => p.dim(s)
  };

  const failures = results.filter((r) => classify(r, config) === 'fail');
  for (const severity of ['critical', 'warning', 'info'] as const) {
    const bucket = failures.filter((r) => effectiveSeverity(r, config) === severity);
    if (bucket.length === 0) continue;
    lines.push(SEVERITY_COLOR[severity](`${SEVERITY_TITLE[severity]} (${bucket.length})`), p.dim(RULE));

    if (options.verbose) {
      for (const r of bucket) {
        lines.push(`${p.red('✗')} ${r.id}  ${r.message}`);
        if (r.route) lines.push(p.dim(`            ${r.route}`));
        if (r.location) lines.push(p.dim(`            ${r.location}${r.line ? `:${r.line}` : ''}`));
      }
    } else {
      const groups = groupByRule(bucket);
      const shownGroups = groups.slice(0, MAX_RULE_GROUPS_PER_BUCKET);
      for (const group of shownGroups) {
        const r = group.results[0]!;
        lines.push(`${p.red('✗')} ${r.id}  ${r.message}`);
        if (r.route) lines.push(p.dim(`            ${r.route}`));
        if (r.location) lines.push(p.dim(`            ${r.location}${r.line ? `:${r.line}` : ''}`));
        if (group.results.length > 1) {
          lines.push(p.dim(`            …and ${group.results.length - 1} more`));
        }
      }
      if (groups.length > MAX_RULE_GROUPS_PER_BUCKET) {
        const remaining = groups.length - MAX_RULE_GROUPS_PER_BUCKET;
        lines.push(p.dim(`…and ${remaining} more rule${remaining > 1 ? 's' : ''} affected — run with --verbose to see all`));
      }
    }
    lines.push('');
  }

  const passed = results.filter((r) => classify(r, config) !== 'fail');
  if (passed.length > 0) {
    lines.push(p.bold(`Passed (${passed.length})`), p.dim(RULE));
    for (const r of passed) {
      const marker = classify(r, config) === 'dynamic' ? p.cyan('  ↯ dynamic') : '';
      const route = r.route ? `  ${r.route}` : '';
      lines.push(`${p.green('✓')} ${r.id}  ${r.message}${marker}${route}`);
    }
    lines.push('');
  }

  if (options.byRoute) lines.push(...byRouteTree(p, results, config));
  if (summary.dynamic > 0) lines.push(p.dim('↯ = set dynamically (verified at runtime).'));

  return lines.join('\n').replace(/\n+$/, '\n');
}
