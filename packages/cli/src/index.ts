import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  allRules,
  runRules,
  formatConsoleReport,
  formatJsonReport,
  formatAgentReport,
  formatSarifReport,
  formatGithubReport,
  formatHtmlReport,
  formatMarkdownReport,
  summarize,
  hasFailureAtOrAbove,
  computeHealth,
  defineConfig,
  selectRules,
  applyRuleSeverities,
  type Severity,
  type RuleSetting,
  type Result,
  type Config,
  type Category
} from '@svelte-vitals/core';
import { createNodeRuntime } from './runtime/node.js';
import { collectRoutes } from './providers/source/routes.js';
import { collectComponentFacts } from './providers/source/components.js';
import { detectProject, ProjectError, collectProjectFacts } from './providers/source/project.js';
import { discoverApps } from './discover-apps.js';
import { readPackageVersion, readCoreVersion } from './version.js';
import { resolveReporter, isAutoDetectedAgent, isAutoDetectedGithub, type ReporterName } from './reporter-resolve.js';
import { getChangedFiles, filterToChangedFiles } from './changed-files.js';
import { checkoutBaseline, filterToNewFindings } from './baseline.js';
import { loadSuppressions, writeSuppressions, applySuppressions, SUPPRESSIONS_FILE } from './suppressions.js';
import { colorEnabled, paletteFor } from './color.js';
import { startSpinner } from './spinner.js';
import { startMascotSpinner, mascotFitsWidth } from './mascot.js';
import { playMascotGreeting, bubbleFitsWidth } from './speech-bubble.js';
import { loadConfigFile } from './config-file.js';
import { playScoreAnimation, scoreAnimationEnabled } from './pulse-animation.js';

export interface RunOptions {
  cwd?: string;
  log?: (line: string) => void;
  errorLog?: (line: string) => void;
  metaComponents?: string[];
  treatDynamicAs?: 'pass' | 'warn' | 'fail';
  /** Restrict analysis to routes whose path matches this glob (matched against the route path without leading slash). */
  route?: string;
  reporter?: ReporterName;
  byRoute?: boolean;
  failOn?: Severity;
  rules?: Record<string, RuleSetting>;
  /** Per-category weights for the combined Health score (flag > config file > default 1 each). */
  weights?: Partial<Record<Category, number>>;
  /** Restrict analysis to rules in these categories (applied after rules/ignore selection). */
  categories?: Category[];
  /** Override process.env for reporter auto-detection (mainly useful in tests). */
  env?: NodeJS.ProcessEnv;
  /** Fail (exit 1) when the combined Health score is below this value (0–100). */
  minHealth?: number;
  /** Print only the combined Health score (integer) to stdout. */
  score?: boolean;
  /** Output path for --reporter html (default 'svelte-vitals-report.html'; '-' = stdout). */
  outFile?: string;
  /** Injected file writer for --reporter html (defaults to node:fs writeFileSync). Mainly for tests. */
  writeFile?: (path: string, content: string) => void;
  /** Report only findings in files changed vs the merge-base with this ref ('HEAD' = uncommitted). Undefined = no gating. */
  diffBase?: string;
  /** Report only findings in files staged for commit. Takes precedence over `diffBase`. */
  staged?: boolean;
  /** Report only findings not present when analyzing this git ref (e.g. the PR base). */
  baseline?: string;
  /** Disable applying svelte-vitals-suppressions.json for this run. */
  noSuppressions?: boolean;
  /** Analyze, then (re)write svelte-vitals-suppressions.json with all currently penalized findings and exit 0. */
  updateSuppressions?: boolean;
  /** Disable ANSI color in console output. */
  noColor?: boolean;
  /** Override stdout TTY detection (tests). */
  stdoutIsTTY?: boolean;
  /** Override stderr TTY detection (tests). */
  stderrIsTTY?: boolean;
  /** Override stdin TTY detection (tests). */
  stdinIsTTY?: boolean;
  /** True when the user passed a path argument — discovery must not run (design: never reinterpret an explicit target). */
  explicitPath?: boolean;
  /** Injected picker for the monorepo app selector (bin.ts wires a clack implementation; null = cancelled). */
  selectApp?: (apps: string[]) => Promise<string | null>;
  /** Show every finding uncapped and ungrouped in console output (default false — capped, grouped by rule). */
  verbose?: boolean;
  /** Disable the Health-score reveal animation even on an interactive stdout. */
  noAnimation?: boolean;
  /** Override the stream the score animation writes to (tests). Defaults to process.stdout. */
  stdoutStream?: NodeJS.WriteStream;
  /** Override the stream the analysis-phase progress indicator writes to (tests). Defaults to process.stderr. */
  stderrStream?: NodeJS.WriteStream;
  /** Override the animation's per-frame delay in ms (tests — 0 runs the real frame loop near-instantly). Defaults to the animation module's own constant. */
  animationFrameDelayMs?: number;
}

/**
 * Whether the "Analyzing…" spinner should run. Unlike color, the spinner animates
 * with carriage returns and escape codes, so it needs a real interactive stderr —
 * `FORCE_COLOR` must NOT force it on in a non-TTY stderr (e.g. CI), where `\r` would
 * clutter the log. So gate on `stderrIsTTY` unconditionally, then reuse the color
 * gating (NO_COLOR / --no-color / agent env) with that same TTY value.
 */
export function spinnerEnabled(opts: {
  reporter: ReporterName;
  rawReporter: ReporterName | undefined;
  stderrIsTTY: boolean;
  env: NodeJS.ProcessEnv;
  noColorFlag?: boolean;
}): boolean {
  return (
    opts.reporter === 'console' &&
    opts.stderrIsTTY &&
    !isAutoDetectedAgent(opts.rawReporter, opts.env) &&
    colorEnabled({ reporter: opts.reporter, isTTY: opts.stderrIsTTY, env: opts.env, noColorFlag: opts.noColorFlag })
  );
}

export function routeMatcher(glob: string | undefined): (route: string) => boolean {
  if (!glob) return () => true;
  const body = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, ' ') // globstar placeholder
    .replace(/\*/g, '[^/]*') // single-segment wildcard (placeholder untouched)
    .replace(/\/ $/g, '(?:/.*)?') // trailing /** -> optional subtree
    .replace(/^ \//g, '(?:.*/)?') // leading **/ -> optional prefix
    .replace(/ \//g, '(?:.*/)?') // internal **/ -> optional prefix
    .replace(/\/ /g, '(?:/.*)?') // internal /** -> optional subtree
    .replace(/ /g, '.*'); // bare ** -> .*
  const re = new RegExp(`^${body}$`);
  return (route) => re.test(route.replace(/^\//, ''));
}

export interface AnalyzeOptions {
  cwd?: string;
  metaComponents?: string[];
  treatDynamicAs?: 'pass' | 'warn' | 'fail';
  /** Restrict analysis to routes whose path matches this glob (matched against the route path without leading slash). */
  route?: string;
  failOn?: Severity;
  rules?: Record<string, RuleSetting>;
  /** Per-category weights for the combined Health score (flag > config file > default 1 each). */
  weights?: Partial<Record<Category, number>>;
  /** Restrict analysis to rules in these categories (applied after rules/ignore selection). */
  categories?: Category[];
}

export interface AnalyzeResult {
  results: Result[];
  config: Config;
  version: string;
  /** Non-fatal config-file issues (unknown top-level keys, invalid enum values). Empty when no config file or none found. */
  warnings: string[];
}

/**
 * Run static-mode analysis and return the structured findings + resolved config.
 * Throws ProjectError when `cwd` is not a SvelteKit project. Also throws when a
 * `svelte-vitals.config.{mjs,js,ts}` file in `cwd` fails to load or fails
 * validation (unknown rule ids in `rules`, invalid `weights` entries) — see
 * `loadConfigFile`. Shared by the CLI's run() and by @svelte-vitals/mcp (issue #24).
 *
 * Config precedence is per field: an explicit option here wins, otherwise the
 * config file's value is used, otherwise the built-in default (design doc
 * 2026-07-05-config-file-design.md §3).
 */
export async function analyzeProject(opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const cwd = opts.cwd ?? process.cwd();
  const rt = createNodeRuntime();

  const loaded = await loadConfigFile(cwd);
  const file = loaded?.config;
  const warnings = loaded?.warnings ?? [];

  const weights = opts.weights ?? file?.weights;
  const config = defineConfig({
    treatDynamicAs: opts.treatDynamicAs ?? file?.treatDynamicAs ?? 'pass',
    metaComponents: opts.metaComponents ?? file?.metaComponents ?? [],
    rules: opts.rules ?? file?.rules ?? {},
    failOn: opts.failOn ?? file?.failOn ?? 'critical',
    ...(weights !== undefined ? { weights } : {})
  });

  await detectProject(rt, cwd); // throws ProjectError if not a SvelteKit project

  const matches = routeMatcher(opts.route);
  const collected = await collectRoutes(rt, cwd, config);
  const heads = collected.heads.filter((h) => matches(h.route));
  const images = collected.images.filter((i) => matches(i.route));
  const headings = collected.headings.filter((h) => matches(h.route));
  const project = await collectProjectFacts(rt, cwd);
  // Component (Correctness) facts are file-scoped with no route attribution yet, so a
  // route-filtered run skips them rather than reporting unrelated components (#68 review).
  const components = opts.route ? [] : await collectComponentFacts(rt, cwd);
  const selected = selectRules(allRules, config);
  const rules = opts.categories ? selected.filter((r) => opts.categories!.includes(r.category)) : selected;
  const results = applyRuleSeverities(
    await runRules(rules, { heads, images, headings, components, project, config }),
    config
  );
  return { results, config, version: readPackageVersion(), warnings };
}

export interface ApplyScopeOptions {
  cwd: string;
  staged?: boolean;
  diffBase?: string;
  baseline?: string;
  /**
   * Resolved config, needed to decide which findings count as "penalized" when
   * applying svelte-vitals-suppressions.json (`isPenalized`). Suppression
   * application is skipped entirely when omitted, keeping such callers'
   * behavior unchanged (the CLI and @svelte-vitals/action both pass it).
   */
  config?: Config;
  /** Disable applying svelte-vitals-suppressions.json for this run. */
  noSuppressions?: boolean;
  errorLog?: (line: string) => void;
  analyzeOpts?: AnalyzeOptions;
}

/**
 * Narrow `results` to what a PR gate cares about: `--staged`/`--diff` restrict to
 * changed files, `--baseline` drops findings that already existed at that ref,
 * and (last) svelte-vitals-suppressions.json drops findings that were explicitly
 * accepted via `--update-suppressions`. Shared by `run()` and
 * `@svelte-vitals/action` (issue #154) so the git-diff/baseline orchestration
 * lives in exactly one place.
 */
export async function applyScope(results: Result[], opts: ApplyScopeOptions): Promise<Result[]> {
  const errorLog = opts.errorLog ?? ((line: string) => console.error(line));
  let scoped = results;

  if (opts.staged || opts.diffBase !== undefined) {
    const changed = opts.staged
      ? getChangedFiles(opts.cwd, { staged: true })
      : getChangedFiles(opts.cwd, { base: opts.diffBase });
    if (changed === undefined) {
      errorLog(
        'svelte-vitals: could not determine changed files (not a git repo, git unavailable, or bad ref); analyzing all.'
      );
    } else {
      scoped = filterToChangedFiles(scoped, changed);
    }
  }

  if (opts.baseline !== undefined) {
    const checkout = checkoutBaseline(opts.cwd, opts.baseline);
    if (checkout === undefined) {
      errorLog(
        `svelte-vitals: could not analyze baseline '${opts.baseline}' (not a git repo, git unavailable, or bad ref); reporting all findings.`
      );
    } else {
      try {
        const base = await analyzeProject({ ...opts.analyzeOpts, cwd: checkout.analyzeCwd });
        scoped = filterToNewFindings(scoped, base.results);
      } catch {
        errorLog(`svelte-vitals: baseline analysis of '${opts.baseline}' failed; reporting all findings.`);
      } finally {
        checkout.cleanup();
      }
    }
  }

  if (!opts.noSuppressions && opts.config) {
    const entries = loadSuppressions(opts.cwd);
    if (entries !== undefined) {
      const { results: afterSuppressions, suppressed, stale } = applySuppressions(scoped, entries, opts.config);
      scoped = afterSuppressions;
      if (suppressed > 0 || stale > 0) {
        errorLog(
          `svelte-vitals: ${suppressed} finding(s) suppressed by ${SUPPRESSIONS_FILE}` +
            (stale > 0
              ? ` (${stale} stale entr${stale === 1 ? 'y' : 'ies'} — re-run --update-suppressions to prune)`
              : '') +
            '.'
        );
      }
    }
  }

  return scoped;
}

/**
 * Run static-mode analysis once and return the process exit code (design §6):
 *   0 = no failing findings, 1 = critical finding present, 2 = execution error.
 */
export async function run(opts: RunOptions = {}): Promise<number> {
  const log = opts.log ?? ((line: string) => console.log(line));
  const errorLog = opts.errorLog ?? ((line: string) => console.error(line));

  if (opts.minHealth != null && (!Number.isFinite(opts.minHealth) || opts.minHealth < 0 || opts.minHealth > 100)) {
    errorLog(`svelte-vitals: invalid minHealth '${opts.minHealth}'; expected a number 0-100.`);
    return 2;
  }

  const env = opts.env ?? process.env;
  const reporter = resolveReporter(opts.reporter, env);
  const stderrStream = opts.stderrStream ?? process.stderr;
  const spinnerBaseEnabled =
    !opts.score &&
    spinnerEnabled({
      reporter,
      rawReporter: opts.reporter,
      stderrIsTTY: opts.stderrIsTTY ?? !!process.stderr.isTTY,
      env,
      noColorFlag: opts.noColor
    });
  const useMascotSpinner = spinnerBaseEnabled && !opts.noAnimation && mascotFitsWidth(stderrStream.columns);
  if (useMascotSpinner && bubbleFitsWidth(stderrStream.columns)) {
    // A wordless greeting isn't worth a dedicated hold before the idle loop, so this
    // only plays when there's room for the speech bubble too — not just the fox alone.
    await playMascotGreeting({ enabled: true, stream: stderrStream, holdMs: opts.animationFrameDelayMs });
  }
  const spinner = useMascotSpinner
    ? startMascotSpinner('Analyzing…', { enabled: true, stream: stderrStream })
    : startSpinner('Analyzing…', { enabled: spinnerBaseEnabled, stream: stderrStream });

  let cwd = opts.cwd ?? process.cwd();

  let analysis: AnalyzeResult;
  try {
    analysis = await analyzeProject({
      cwd,
      metaComponents: opts.metaComponents,
      treatDynamicAs: opts.treatDynamicAs,
      route: opts.route,
      failOn: opts.failOn,
      rules: opts.rules,
      weights: opts.weights,
      categories: opts.categories
    });
  } catch (err) {
    spinner.stop();
    if (err instanceof ProjectError) {
      // Monorepo app auto-detection + picker (design doc 2026-07-08-monorepo-app-picker-design.md):
      // only kicks in when the user didn't name a target — an explicit path's failure is never
      // silently reinterpreted.
      if (opts.explicitPath) {
        errorLog(err.message);
        return 2;
      }
      const apps = await discoverApps(cwd);
      if (apps.length === 0) {
        errorLog(err.message);
        return 2;
      }
      let chosen: string;
      if (apps.length === 1) {
        errorLog(`svelte-vitals: detected SvelteKit app at ${apps[0]}; analyzing it.`);
        chosen = apps[0]!;
      } else if (
        // clack reads from stdin and renders to stdout, so both must be interactive —
        // a piped/redirected stdin would leave the prompt hanging for input that never comes.
        (opts.stdinIsTTY ?? !!process.stdin.isTTY) &&
        (opts.stdoutIsTTY ?? !!process.stdout.isTTY) &&
        opts.selectApp
      ) {
        const selection = await opts.selectApp(apps);
        if (selection === null) {
          log('Cancelled.');
          return 0;
        }
        chosen = selection;
      } else {
        errorLog(`svelte-vitals: multiple SvelteKit apps found: ${apps.join(', ')}.`);
        errorLog(`svelte-vitals: pass one as a path, e.g. \`npx svelte-vitals ${apps[0]}\`.`);
        return 2;
      }
      cwd = join(cwd, chosen);
      try {
        analysis = await analyzeProject({
          cwd,
          metaComponents: opts.metaComponents,
          treatDynamicAs: opts.treatDynamicAs,
          route: opts.route,
          failOn: opts.failOn,
          rules: opts.rules,
          weights: opts.weights,
          categories: opts.categories
        });
      } catch (err2) {
        if (err2 instanceof ProjectError) {
          errorLog(err2.message);
          return 2;
        }
        errorLog(`svelte-vitals: ${err2 instanceof Error ? err2.message : String(err2)}`);
        return 2;
      }
    } else {
      errorLog(`svelte-vitals: ${err instanceof Error ? err.message : String(err)}`);
      return 2;
    }
  }
  spinner.stop();

  for (const w of analysis.warnings) errorLog(`svelte-vitals: ${w}`);

  try {
    const { config, version } = analysis;

    if (opts.updateSuppressions) {
      // Scoping flags (--diff/--staged/--baseline) are deliberately ignored here —
      // the suppressions file is meant to record the whole project's current state,
      // not a diff (design doc 2026-07-13-suppressions-file-design.md, decision 2).
      const count = writeSuppressions(cwd, analysis.results, config);
      errorLog(`svelte-vitals: wrote ${count} suppression(s) to ${SUPPRESSIONS_FILE}.`);
      return 0;
    }

    const results = await applyScope(analysis.results, {
      cwd,
      config,
      staged: opts.staged,
      diffBase: opts.diffBase,
      baseline: opts.baseline,
      noSuppressions: opts.noSuppressions,
      errorLog,
      analyzeOpts: {
        metaComponents: opts.metaComponents,
        treatDynamicAs: opts.treatDynamicAs,
        route: opts.route,
        failOn: opts.failOn,
        rules: opts.rules,
        weights: opts.weights,
        categories: opts.categories
      }
    });
    const summary = summarize(results, config);

    if (opts.score) {
      log(String(computeHealth(results, config).health));
    } else {
      if (reporter === 'agent' && isAutoDetectedAgent(opts.reporter, env)) {
        errorLog(
          'svelte-vitals: agent reporter auto-selected (AI-agent env detected); override with --reporter console|json.'
        );
      }
      if (reporter === 'github' && isAutoDetectedGithub(opts.reporter, env)) {
        errorLog(
          'svelte-vitals: github reporter auto-selected (GitHub Actions detected); override with --reporter console|json|sarif.'
        );
      }
      if (reporter === 'json') {
        log(formatJsonReport(results, config, { version }));
      } else if (reporter === 'agent') {
        log(formatAgentReport(results, config));
      } else if (reporter === 'sarif') {
        log(formatSarifReport(results, config, { version }));
      } else if (reporter === 'github') {
        // The github reporter returns '' when there are no findings; skip logging so
        // a clean run emits no stray blank line into the Actions log.
        const output = formatGithubReport(results, config);
        if (output) log(output);
      } else if (reporter === 'html') {
        const html = formatHtmlReport(results, config, { version, coreVersion: readCoreVersion() });
        if (opts.outFile === '-') {
          log(html);
        } else {
          // `||` (not `??`) so an empty --out-file (mri yields '' for a value-less
          // flag) falls back to the default instead of writing to an empty path.
          const path = opts.outFile || 'svelte-vitals-report.html';
          const write =
            opts.writeFile ??
            ((p: string, c: string) => {
              mkdirSync(dirname(p), { recursive: true });
              writeFileSync(p, c);
            });
          write(path, html);
          errorLog(`svelte-vitals: wrote report to ${path}`);
        }
      } else if (reporter === 'md') {
        log(formatMarkdownReport(results, config, { version }));
      } else {
        const stdoutIsTTY = opts.stdoutIsTTY ?? !!process.stdout.isTTY;
        const colorOn = colorEnabled({
          reporter,
          isTTY: stdoutIsTTY,
          env,
          noColorFlag: opts.noColor
        });
        const palette = paletteFor(colorOn);
        const animate = scoreAnimationEnabled({
          reporter,
          stdoutIsTTY,
          env,
          noColorFlag: opts.noColor,
          noAnimationFlag: opts.noAnimation
        });
        if (animate) {
          await playScoreAnimation({
            score: computeHealth(results, config).health,
            palette,
            stream: opts.stdoutStream ?? process.stdout,
            frameDelayMs: opts.animationFrameDelayMs
          });
        }
        log(
          formatConsoleReport(results, config, {
            byRoute: opts.byRoute ?? false,
            verbose: opts.verbose ?? false,
            palette,
            omitHeader: animate
          })
        );
      }
    }
    const failBySeverity = hasFailureAtOrAbove(summary, config.failOn);
    const failByHealth = opts.minHealth != null && computeHealth(results, config).health < opts.minHealth;
    return failBySeverity || failByHealth ? 1 : 0;
  } catch (err) {
    errorLog(`svelte-vitals: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
}

export { ProjectError } from './providers/source/project.js';
export { buildRulesConfig, findUnknownRuleIds, knownRuleIds } from './rules-config.js';
export { loadConfigFile } from './config-file.js';
export type { LoadedConfigFile } from './config-file.js';
// Re-exported so user config files can `import { defineConfig } from 'svelte-vitals'`
// (the package they actually installed) instead of the transitive `@svelte-vitals/core`
// (design doc 2026-07-05-config-file-design.md §5).
export { defineConfig } from '@svelte-vitals/core';
