import { type Category, type Config, type Result, type Severity } from '../types.js';
import { classify, summarize, effectiveSeverity } from '../summary.js';
import { computeScore, computeHealth, type ScoreResult } from '../scoring/score.js';
import { noColorPalette, scoreColor, type Palette } from './palette.js';
import { terminalSafe } from './sanitize.js';

const RULE = '────────────────────────';
const SEVERITY_TITLE = {
  critical: 'Critical',
  warning: 'Warnings',
  info: 'Info'
} satisfies Record<Severity, string>;

// Record<Category, string> keeps this exhaustive by type: a new category fails compilation
// here instead of silently vanishing from the console report. Declaration order is the
// display order.
export const CATEGORY_LABEL = {
  seo: 'SEO',
  performance: 'Performance',
  correctness: 'Correctness',
  security: 'Security',
  architecture: 'Architecture',
  a11y: 'Accessibility'
} satisfies Record<Category, string>;
const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL) as readonly Category[];

const categoryLabel = (c: Category) => CATEGORY_LABEL[c];

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
  /** Internal: set by the CLI when it has already animated the Health header itself — skips the brand/Health lines (category score lines still print). Default false. */
  omitHeader?: boolean;
}

function scoreLine(p: Palette, label: string, { score, scoreModel }: ScoreResult): string {
  const parts = [`route avg ${scoreModel.routeAverage}`];
  if (scoreModel.sitePenalty > 0) parts.push(`site −${scoreModel.sitePenalty}`);
  if (scoreModel.criticalCap !== null) parts.push(`capped at ${scoreModel.criticalCap}: critical present`);
  return `${label} Score: ${scoreColor(p, score)(`${score}/100`)}   ${p.dim(`(${parts.join(' · ')})`)}`;
}

const MAX_ROUTES_BY_ROUTE = 10;

function byRouteTree(p: Palette, results: Result[], config: Config, verbose: boolean): string[] {
  const routes = new Map<string, Result[]>();
  for (const r of results) {
    if (r.route === undefined) continue;
    if (!routes.has(r.route)) routes.set(r.route, []);
    routes.get(r.route)!.push(r);
  }
  const scored = [...routes.entries()].map(([route, rs]) => ({
    route,
    rs,
    score: computeScore(rs, config, { applyCriticalCap: false }).score
  }));
  // Worst first (ascending score) — the routes most in need of attention lead, which is
  // also what makes a cap meaningful: the routes cut off are the healthiest ones.
  scored.sort((a, b) => a.score - b.score || a.route.localeCompare(b.route));

  const shown = verbose ? scored : scored.slice(0, MAX_ROUTES_BY_ROUTE);
  const lines: string[] = [p.bold('By route'), p.dim(RULE)];
  for (const { route, rs, score } of shown) {
    lines.push(`${terminalSafe(route).padEnd(28)} ${scoreColor(p, score)(`${score}`)}`);
    for (const r of rs.filter((x) => classify(x, config) === 'fail')) {
      lines.push(`    ${p.red('✗')} ${r.id}  ${terminalSafe(r.message)}`);
    }
  }
  if (!verbose && scored.length > MAX_ROUTES_BY_ROUTE) {
    const remaining = scored.slice(MAX_ROUTES_BY_ROUTE);
    // Floor, not round, for the same reason as the rest of this branch: rounding this tail
    // average can print a perfect 100 over a hidden tail that still contains a penalized route.
    const avgScore = Math.floor(remaining.reduce((sum, r) => sum + r.score, 0) / remaining.length);
    lines.push(
      p.dim(
        `…and ${remaining.length} more route${remaining.length > 1 ? 's' : ''} (avg score ${avgScore}) — run with --verbose to see all`
      )
    );
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
  const lines: string[] = [];
  if (!options.omitHeader) {
    lines.push(
      p.bold(`Svelte Vitals  ·  ${options.mode ?? 'static mode'}`),
      '',
      `${p.bold('Health:')} ${scoreColor(p, health)(`${health}/100`)}`
    );
  }
  for (const c of present) {
    lines.push(scoreLine(p, categoryLabel(c), byCat[c]!));
  }
  lines.push('');

  const SEVERITY_COLOR = {
    critical: (s: string) => p.red(p.bold(s)),
    warning: (s: string) => p.yellow(p.bold(s)),
    info: (s: string) => p.dim(s)
  } satisfies Record<Severity, (s: string) => string>;

  const failures = results.filter((r) => classify(r, config) === 'fail');
  for (const severity of ['critical', 'warning', 'info'] as const) {
    const bucket = failures.filter((r) => effectiveSeverity(r, config) === severity);
    if (bucket.length === 0) continue;
    lines.push(SEVERITY_COLOR[severity](`${SEVERITY_TITLE[severity]} (${bucket.length})`), p.dim(RULE));

    if (options.verbose) {
      for (const r of bucket) {
        lines.push(`${p.red('✗')} ${r.id}  ${terminalSafe(r.message)}`);
        if (r.route) lines.push(p.dim(`            ${terminalSafe(r.route)}`));
        if (r.location) lines.push(p.dim(`            ${terminalSafe(r.location)}${r.line ? `:${r.line}` : ''}`));
      }
    } else {
      const groups = groupByRule(bucket);
      const shownGroups = groups.slice(0, MAX_RULE_GROUPS_PER_BUCKET);
      for (const group of shownGroups) {
        const r = group.results[0]!;
        lines.push(`${p.red('✗')} ${r.id}  ${terminalSafe(r.message)}`);
        if (r.route) lines.push(p.dim(`            ${terminalSafe(r.route)}`));
        if (r.location) lines.push(p.dim(`            ${terminalSafe(r.location)}${r.line ? `:${r.line}` : ''}`));
        if (group.results.length > 1) {
          lines.push(p.dim(`            …and ${group.results.length - 1} more`));
        }
      }
      if (groups.length > MAX_RULE_GROUPS_PER_BUCKET) {
        const remaining = groups.length - MAX_RULE_GROUPS_PER_BUCKET;
        lines.push(
          p.dim(`…and ${remaining} more rule${remaining > 1 ? 's' : ''} affected — run with --verbose to see all`)
        );
      }
    }
    lines.push('');
  }

  const passed = results.filter((r) => classify(r, config) !== 'fail');
  if (passed.length > 0) {
    lines.push(p.bold(`Passed (${passed.length})`), p.dim(RULE));
    if (options.verbose) {
      for (const r of passed) {
        const marker = classify(r, config) === 'dynamic' ? p.cyan('  ↯ dynamic') : '';
        // `location` first: a route-less pass (e.g. architecture/unit-entry-file, which keeps
        // only `location`) must still name the unit it checked, not render an identical,
        // path-less line for every one of them.
        const where = r.location ?? r.route;
        const suffix = where ? `  ${terminalSafe(where)}` : '';
        lines.push(`${p.green('✓')} ${r.id}  ${terminalSafe(r.message)}${marker}${suffix}`);
      }
    }
    lines.push('');
  }

  if (options.byRoute) lines.push(...byRouteTree(p, results, config, options.verbose ?? false));
  // The ↯ marker itself only ever prints in the verbose Passed listing above — showing
  // this footnote in compact mode would explain a symbol the user can't see anywhere.
  if (options.verbose && summary.dynamic > 0) lines.push(p.dim('↯ = set dynamically (verified at runtime).'));

  return lines.join('\n').replace(/\n+$/, '\n');
}
