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
  applyOverrides,
  type Severity,
  type RuleSetting,
  type Result,
  type Config,
  type Category
} from '@svelte-vitals/core';
import { createNodeRuntime } from './runtime/node.js';
import type { ParseCache } from './providers/source/resolve.js';
import { detectProject, ProjectError, checkVersionFloor } from './providers/source/project.js';
import { collectAll } from './collect-all.js';
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
import { loadConfigFile, type LoadedConfigFile } from './config-file.js';
import { playScoreAnimation, scoreAnimationEnabled } from './pulse-animation.js';
import { resolveRuleSelection } from './rule-selection.js';

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
  /**
   * A complete replacement for the config file's `rules` map — what the Vite plugin and
   * programmatic callers pass. Whole-field, per the per-field precedence every other config
   * field follows.
   */
  rules?: Record<string, RuleSetting>;
  /**
   * Rule ids to silence on top of `rules`/the config file (--ignore). Unlike `rules`, this
   * never replaces anything — it only ever adds `'off'` entries for the ids listed, so a
   * rule not named here keeps whatever `rules`/the file said for it (design:
   * rules-flag-clobbers-config-options).
   */
  ignoreRules?: string[];
  /** `--rules`: run only these rule ids. Selection; the config file still supplies their options. */
  allowRules?: string[];
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

export interface AnalyzeOptions {
  cwd?: string;
  metaComponents?: string[];
  treatDynamicAs?: 'pass' | 'warn' | 'fail';
  /** Restrict analysis to routes whose path matches this glob (matched against the route path without leading slash). */
  route?: string;
  failOn?: Severity;
  /**
   * A complete replacement for the config file's `rules` map — what the Vite plugin and
   * programmatic callers pass. Whole-field, per the per-field precedence every other config
   * field follows.
   */
  rules?: Record<string, RuleSetting>;
  /**
   * Rule ids to silence on top of `rules`/the config file (--ignore). Unlike `rules`, this
   * never replaces anything — it only ever adds `'off'` entries for the ids listed, so a
   * rule not named here keeps whatever `rules`/the file said for it (design:
   * rules-flag-clobbers-config-options).
   */
  ignoreRules?: string[];
  /** `--rules`: run only these rule ids. Selection; the config file still supplies their options. */
  allowRules?: string[];
  /** Per-category weights for the combined Health score (flag > config file > default 1 each). */
  weights?: Partial<Record<Category, number>>;
  /** Restrict analysis to rules in these categories (applied after rules/ignore selection). */
  categories?: Category[];
  /**
   * Reuse this parse cache across multiple `analyzeProject` calls instead of
   * starting fresh each time — the vite dev dashboard passes a long-lived cache
   * and invalidates only the changed file's entry between re-analyses, so
   * unchanged routes/layouts are never re-read or re-parsed. This only covers
   * the route/layout (head-resolution) parse path via `collectRoutes` —
   * `collectComponentFacts` (Correctness facts) is unaffected and still scans
   * every component on each call. Callers that don't need cross-call reuse
   * (the CLI's `run()`, the Action — each analyzes once per process) can
   * omit this; a fresh cache is created automatically.
   */
  parseCache?: ParseCache;
  /**
   * Result of a `loadConfigFile()` call to reuse instead of loading from `cwd`.
   * Pass the value loaded from the real project so a secondary analysis (the
   * `--baseline` worktree) runs under the same config file; `null` means "the
   * project has no config file — do not look for one".
   */
  loadedConfig?: LoadedConfigFile | null;
}

export interface AnalyzeResult {
  results: Result[];
  config: Config;
  version: string;
  /** Ids of the rules that ran, after `--category` narrowing. The JSON report lists these so a rule that found nothing stays distinguishable from one that was never selected. */
  ruleIds: string[];
  /** Per-rule, per-declaration counts of places examined, unfiltered by `--diff`/`--baseline`/suppressions. */
  examined: Record<string, Record<string, number>>;
  /** Non-fatal config-file issues (unknown top-level keys, invalid enum values). Empty when no config file or none found. */
  warnings: string[];
  /**
   * This analysis's config-file load result (`undefined` when no config file exists at its
   * `cwd`). A caller running a second `analyzeProject` against a different cwd for the same
   * logical project (e.g. `applyScope`'s `--baseline` worktree) should pass this back in via
   * `AnalyzeOptions.loadedConfig` (`?? null`) so both sides run under the same config.
   */
  loadedConfig?: LoadedConfigFile;
}

/**
 * Run static-mode analysis and return the structured findings + resolved config.
 * Throws ProjectError when `cwd` is not a SvelteKit project. Also throws when a
 * `svelte-vitals.config.{mjs,js,ts}` file in `cwd` fails to load or fails
 * validation (unknown rule ids in `rules`, invalid `weights` entries) — see
 * `loadConfigFile`. Shared by the CLI's run() and by embedding callers (issue #24).
 *
 * Config precedence is per field: an explicit option here wins, otherwise the
 * config file's value is used, otherwise the built-in default (design doc
 * 2026-07-05-config-file-design.md §3).
 */
export async function analyzeProject(opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const cwd = opts.cwd ?? process.cwd();
  const rt = createNodeRuntime();

  const loaded = opts.loadedConfig !== undefined ? (opts.loadedConfig ?? undefined) : await loadConfigFile(cwd);
  const file = loaded?.config;

  const weights = opts.weights ?? file?.weights;
  const config = defineConfig({
    treatDynamicAs: opts.treatDynamicAs ?? file?.treatDynamicAs ?? 'pass',
    metaComponents: opts.metaComponents ?? file?.metaComponents ?? [],
    rules: resolveRuleSelection({
      fileRules: file?.rules,
      rules: opts.rules,
      allowRules: opts.allowRules,
      ignoreRules: opts.ignoreRules
    }),
    failOn: opts.failOn ?? file?.failOn ?? 'critical',
    ...(weights !== undefined ? { weights } : {}),
    ...(file?.overrides !== undefined ? { overrides: file.overrides } : {})
  });

  await detectProject(rt, cwd); // throws ProjectError if not a SvelteKit project
  const warnings = [...(loaded?.warnings ?? []), ...(await checkVersionFloor(rt, cwd))];

  const { heads, images, headings, project, components, kitModules, sourceFiles } = await collectAll(rt, cwd, config, {
    route: opts.route,
    parseCache: opts.parseCache
  });
  const selected = selectRules(allRules, config);
  const rules = opts.categories ? selected.filter((r) => opts.categories!.includes(r.category)) : selected;
  const { results: rawResults, examined } = await runRules(rules, {
    heads,
    images,
    headings,
    components,
    project,
    config,
    kitModules,
    sourceFiles
  });
  const results = applyOverrides(applyRuleSeverities(rawResults, config), config);
  return {
    results,
    config,
    version: readPackageVersion(),
    ruleIds: rules.map((r) => r.id),
    examined,
    warnings,
    loadedConfig: loaded
  };
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
 * The analyze options every `analyzeProject` call in `run()` shares, including `applyScope`'s
 * baseline re-analysis — an option reaching one of those paths and not another is silent: a
 * baseline analyzed under different rules reports every pre-existing finding as new.
 */
function runAnalyzeOptions(opts: RunOptions): AnalyzeOptions {
  return {
    metaComponents: opts.metaComponents,
    treatDynamicAs: opts.treatDynamicAs,
    route: opts.route,
    failOn: opts.failOn,
    rules: opts.rules,
    ignoreRules: opts.ignoreRules,
    allowRules: opts.allowRules,
    weights: opts.weights,
    categories: opts.categories
  };
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
    analysis = await analyzeProject({ ...runAnalyzeOptions(opts), cwd });
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
        analysis = await analyzeProject({ ...runAnalyzeOptions(opts), cwd });
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
      // No `cwd` — applyScope analyzes the baseline in its own checkout. `loadedConfig` reuses
      // this run's config-file load so the baseline side doesn't re-load svelte-vitals.config.*
      // from inside the worktree, which has no node_modules in its ancestry.
      analyzeOpts: { ...runAnalyzeOptions(opts), loadedConfig: analysis.loadedConfig ?? null }
    });
    const summary = summarize(results, config);

    if (opts.score) {
      log(String(computeHealth(results, config).health));
    } else {
      if (reporter === 'agent' && isAutoDetectedAgent(opts.reporter, env)) {
        errorLog(
          'svelte-vitals: agent reporter auto-selected (AI-agent env detected); override with --reporter console|json. ' +
            'Run `svelte-vitals docs list` for the bundled guides.'
        );
      }
      if (reporter === 'github' && isAutoDetectedGithub(opts.reporter, env)) {
        errorLog(
          'svelte-vitals: github reporter auto-selected (GitHub Actions detected); override with --reporter console|json|sarif.'
        );
      }
      if (reporter === 'json') {
        log(formatJsonReport(results, config, { version }, analysis.ruleIds, analysis.examined));
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
          // `||` (not `??`) so an empty outFile from a programmatic caller falls back
          // to the default instead of writing to an empty path.
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
export { routeMatcher } from './route-matcher.js';
export type { ParseCache } from './providers/source/resolve.js';
export { findUnknownRuleIds, knownRuleIds, ruleOptionsSpec } from './rules-config.js';
export { loadConfigFile } from './config-file.js';
export type { LoadedConfigFile } from './config-file.js';
// Re-exported so user config files can `import { defineConfig } from 'svelte-vitals'`
// (the package they actually installed) instead of the transitive `@svelte-vitals/core`
// (design doc 2026-07-05-config-file-design.md §5).
export { defineConfig } from '@svelte-vitals/core';
