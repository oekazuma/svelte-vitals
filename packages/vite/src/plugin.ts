import { existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, isAbsolute, dirname, relative, basename, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import type { Category, RuleOptions, RuleOverride, RuleSetting, Severity, TreatDynamicAs } from '@svelte-vitals/core';
import { defaultConfig, defineConfig, resolveRuleOptions, validateRuleOptions } from '@svelte-vitals/core';
import { findUnknownRuleIds, knownRuleIds, loadConfigFile, ruleOptionsSpec } from 'svelte-vitals';
import { analyze } from './analyze.js';
import { resolveMinifyDisabled } from './minify-flag.js';
import { installUiMiddleware } from './ui/middleware.js';
import { createStore } from './ui/store.js';
import { createAnalysisRunner } from './ui/analysis.js';
import { readPackageVersion, readCoreVersion } from './version.js';

const CONFIG_BASENAMES = new Set([
  'svelte.config.js',
  'svelte.config.ts',
  'svelte-vitals.config.mjs',
  'svelte-vitals.config.js',
  'svelte-vitals.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
  'vite.config.cjs',
  'vite.config.mts',
  'vite.config.cts'
]);

const IGNORED_SEGMENTS = new Set(['node_modules', '.svelte-kit', 'build', 'dist']);

/**
 * Whether a `server.watcher` event on `file` should trigger a dev-dashboard re-analysis:
 * anything under `src/` or `static/` (the default SvelteKit layout this dashboard assumes),
 * or a `svelte.config.*` / `svelte-vitals.config.*` / `vite.config.*` at any depth (editing
 * the Vite config can change the performance/minify-disabled fact) — excluding build/dependency
 * output so their churn never triggers a spurious re-run. Exported for tests.
 */
export function isRelevant(file: string, root: string): boolean {
  const rel = relative(root, file);
  if (rel === '' || rel.startsWith('..')) return false; // outside the project root
  const segments = rel.split(sep);
  if (segments.some((s) => IGNORED_SEGMENTS.has(s))) return false;
  if (CONFIG_BASENAMES.has(basename(file))) return true;
  return segments[0] === 'src' || segments[0] === 'static';
}

export interface SvelteVitalsOptions {
  /** Project root (defaults to the Vite config root / cwd). */
  cwd?: string;
  treatDynamicAs?: TreatDynamicAs;
  metaComponents?: string[];
  rules?: Record<string, RuleSetting>;
  /** Route-/file-scoped rule overrides applied to build-gate results (option > config file). */
  overrides?: RuleOverride[];
  /** Minimum severity that fails the build (default: 'critical'). */
  failOn?: Severity;
  /** Per-category weights for the combined Health score shown in the JSON/console report (flag > config file > default 1 each). */
  weights?: Partial<Record<Category, number>>;
  /** Report output (default: 'console'). */
  report?: 'console' | 'json' | false;
  /** Write the JSON report to this path. */
  outFile?: string;
  /** Override the prerendered-pages directory (default: .svelte-kit/output/prerendered/pages). */
  prerenderDir?: string;
  /**
   * Serve a live dashboard at /__svelte-vitals/ during `vite dev` (add
   * svelteVitalsHandle to hooks.server.ts for accurate, per-route `measured` results
   * as you browse — the dashboard still works without it, from whole-project static
   * analysis alone). Default: `true`. Pass `false` to keep only the build-time gate.
   */
  ui?: boolean;
}

const DEFAULT_PRERENDER_DIR = '.svelte-kit/output/prerendered/pages';

const CATEGORIES: Category[] = ['seo', 'performance', 'correctness', 'security', 'architecture'];

/**
 * Validate the plugin's `rules` option the same way the CLI's config-file loader
 * validates a config file's `rules` map (design 2026-07-26, Finding 4): an unknown
 * rule id, or (for a known id) an unknown option key or a type/bounds/range
 * violation, is fatal, not silently dropped. `options.rules` never passes through
 * `loadConfigFile` (that only validates `svelte-vitals.config.*`), so this is the
 * only check a plugin-option `rules` value gets. Unknown ids are rejected first —
 * as the CLI does — so a typo'd id with options reports "unknown rule id", not a
 * misleading "takes no options" (2026-07-26 second review, Finding D). Severity
 * strings are still caught by TypeScript for TS consumers; this covers options,
 * which `resolveRuleOptions` would otherwise drop unknown keys from silently.
 */
function validateRulesOption(rules: Record<string, RuleSetting> | undefined): void {
  if (!rules) return;
  const unknown = findUnknownRuleIds(Object.keys(rules));
  if (unknown.length > 0) {
    throw new Error(
      `svelte-vitals: invalid \`rules\` option — unknown rule id(s): ${unknown.join(', ')}. ` +
        `Known rule ids: ${knownRuleIds().join(', ')}`
    );
  }
  const errors: string[] = [];
  for (const [id, setting] of Object.entries(rules)) {
    if (typeof setting === 'string' || setting.options === undefined) continue;
    errors.push(...validateRuleOptions(id, ruleOptionsSpec(id), setting.options));
  }
  if (errors.length > 0) throw new Error(`svelte-vitals: invalid \`rules\` option — ${errors.join(' ')}`);
}

/**
 * Whether some *other* entry in `overrides` narrows the opposite side of a
 * min/max range for the same rule key. Two override entries can both apply
 * to the same target at once (their `route`/`files` scopes are not mutually
 * exclusive), so an entry that narrows only `min` might combine with another
 * entry's `max` at a shared target and be valid there — but which entries
 * actually co-apply depends on the target's route/file, which is unknowable
 * at plugin-construction time. This is therefore a conservative "might
 * they?" check: `true` means the single-layer baseline this entry would
 * otherwise be validated against can't be trusted, so the caller skips the
 * range cross-check for this entry rather than risk rejecting a config that
 * is valid at every target (design 2026-07-26 review, Finding A, third
 * pass; mirrors the CLI's `otherOverrideNarrowsOppositeSide` in
 * packages/cli/src/config-file.ts).
 *
 * The reverse failure mode — two entries that each look valid alone but
 * jointly invert the range at a target where both apply — stays undetected,
 * for the same reason; see the design doc's "Out of scope" section.
 */
function otherOverrideNarrowsOppositeSide(
  overrides: RuleOverride[],
  selfIndex: number,
  key: string,
  side: 'min' | 'max'
): boolean {
  return overrides.some((entry, i) => {
    if (i === selfIndex) return false;
    const setting = entry.rules?.[key];
    return typeof setting === 'object' && setting !== null && setting.options !== undefined && side in setting.options;
  });
}

/**
 * Validate the plugin's `overrides` option (2026-07-26 second review, Finding C):
 * previously only `options.rules` was validated, so a typo inside
 * `overrides[].rules[id].options` — the field the changeset advertises as the
 * per-path home for options — silently dropped the option instead of failing
 * loudly. Same fatal/known-id/carve-out rules as the CLI's config-file loader:
 * unknown rule ids (rejected before options, per Finding D) or categories are
 * fatal; a category key may carry a severity but never `options`; a rule-id
 * key's options are validated against the baseline resolved from `rules`
 * (built-in defaults + the plugin's own `rules` option), so an override that
 * only narrows one side of an already-widened range isn't falsely rejected
 * (Finding A) — including when the widening comes from another `overrides[]`
 * entry rather than the global `rules` layer (Finding A, third pass; see
 * `otherOverrideNarrowsOppositeSide`).
 */
function validateOverridesOption(
  overrides: RuleOverride[] | undefined,
  rules: Record<string, RuleSetting> | undefined
): void {
  if (!overrides) return;
  const baseConfig = { ...defaultConfig, rules: rules ?? {} };
  const errors: string[] = [];
  overrides.forEach((entry, i) => {
    const entryRules = entry.rules ?? {};
    const nonCategoryKeys = Object.keys(entryRules).filter((k) => !CATEGORIES.includes(k as Category));
    const unknown = findUnknownRuleIds(nonCategoryKeys);
    if (unknown.length > 0) {
      throw new Error(
        `svelte-vitals: invalid \`overrides\` option — overrides[${i}]: unknown rule id(s) or categories: ` +
          `${unknown.join(', ')}. Known categories: ${CATEGORIES.join(', ')}. Known rule ids: ${knownRuleIds().join(', ')}`
      );
    }
    for (const [key, setting] of Object.entries(entryRules)) {
      if (typeof setting === 'string' || setting.options === undefined) continue;
      const isCategory = CATEGORIES.includes(key as Category);
      if (isCategory) {
        errors.push(`overrides[${i}].rules.${key}: options are not allowed on a category key.`);
        continue;
      }
      const baseline: RuleOptions = resolveRuleOptions(key, ruleOptionsSpec(key), baseConfig);
      const setsMin = 'min' in setting.options;
      const setsMax = 'max' in setting.options;
      const skipRangeCheck =
        (setsMin && !setsMax && otherOverrideNarrowsOppositeSide(overrides, i, key, 'max')) ||
        (setsMax && !setsMin && otherOverrideNarrowsOppositeSide(overrides, i, key, 'min'));
      errors.push(
        ...validateRuleOptions(key, ruleOptionsSpec(key), setting.options, baseline, skipRangeCheck).map(
          (e) => `overrides[${i}]: ${e}`
        )
      );
    }
  });
  if (errors.length > 0) throw new Error(`svelte-vitals: invalid \`overrides\` option — ${errors.join(' ')}`);
}

/** svelte-vitals Vite/SvelteKit plugin. */
export function svelteVitals(options: SvelteVitalsOptions = {}): Plugin | Plugin[] {
  validateRulesOption(options.rules);
  validateOverridesOption(options.overrides, options.rules);
  let root = options.cwd ?? process.cwd();
  let minifyFlag: { minify: unknown; configFile: string | undefined } | undefined;
  const buildPlugin: Plugin = {
    name: 'svelte-vitals',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      if (!options.cwd) root = config.root;
      // Vite <=7 resolves top-level build.minify to false whenever build.ssr is set —
      // judge only the client build, which reflects user intent on every Vite version.
      if (!config.build.ssr) minifyFlag = { minify: config.build.minify, configFile: config.configFile };
    },
    async closeBundle() {
      const pagesDir = options.prerenderDir ? options.prerenderDir : join(root, DEFAULT_PRERENDER_DIR);
      const resolved = isAbsolute(pagesDir) ? pagesDir : join(root, pagesDir);

      // SvelteKit calls closeBundle TWICE: once during the JS bundle phase
      // (before prerendering, dir absent) and once after the adapter writes
      // prerendered HTML (Task 2 spike). Skip the early/empty invocation so we
      // don't emit a spurious "0 routes" report or gate on nothing.
      if (!existsSync(resolved)) return;

      let result;
      try {
        const viteMinifyDisabled = minifyFlag
          ? await resolveMinifyDisabled(minifyFlag.minify, minifyFlag.configFile, root)
          : undefined;
        result = await analyze(resolved, root, options, viteMinifyDisabled ? { viteMinifyDisabled } : undefined);
      } catch (err) {
        // The analysis itself failed (unreadable/malformed output, glob error,
        // …). That's our problem, not a real SEO finding, so warn and skip the
        // gate instead of failing the whole build — distinct from `result.failed`.
        console.warn(`svelte-vitals: skipped — analysis failed: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
      for (const w of result.warnings) console.warn(`svelte-vitals: ${w}`);
      if (result.routeCount === 0) return;

      if (options.report !== false) {
        const out = options.report === 'json' ? result.jsonReport : result.consoleReport;
        console.log(out);
      }
      if (options.outFile) {
        const outPath = isAbsolute(options.outFile) ? options.outFile : join(root, options.outFile);
        await mkdir(dirname(outPath), { recursive: true });
        await writeFile(outPath, result.jsonReport);
      }
      if (result.failed) {
        throw new Error(`svelte-vitals: build failed — findings at or above "${result.failOn}".`);
      }
    }
  };

  // `ui` defaults to true: the plugin's real dev-time value is the live dashboard
  // (2026-07-12-retire-dev-overlay-design.md) — pass `ui: false` to keep only the
  // build-time gate.
  if (options.ui === false) return buildPlugin;

  const uiPlugin: Plugin = {
    name: 'svelte-vitals:ui',
    apply: 'serve',
    async configureServer(server: ViteDevServer) {
      process.env.SVELTE_VITALS_UI = '1';
      const uiRoot = options.cwd ?? server.config.root;

      // Same precedence as the CLI's analyzeProject / build-mode analyze(): an explicit
      // plugin option wins, otherwise svelte-vitals.config.* in uiRoot, otherwise the
      // built-in default. This `config` drives the dashboard's rendering/scoring
      // (installUiMiddleware → buildSnapshot → buildJsonReport) — the whole-project
      // `runner` below gets its config-file values independently, since it calls
      // analyzeProject (which loads the config file itself).
      const loaded = await loadConfigFile(uiRoot);
      const fileConfig = loaded?.config;
      for (const w of loaded?.warnings ?? []) console.warn(`svelte-vitals: ${w}`);
      const weights = options.weights ?? fileConfig?.weights;
      const config = defineConfig({
        treatDynamicAs: options.treatDynamicAs ?? fileConfig?.treatDynamicAs ?? 'pass',
        metaComponents: options.metaComponents ?? fileConfig?.metaComponents ?? [],
        rules: options.rules ?? fileConfig?.rules ?? {},
        failOn: options.failOn ?? fileConfig?.failOn ?? 'critical',
        ...(weights !== undefined ? { weights } : {})
      });
      const store = createStore();

      // Whole-project static analysis: one run at startup (never blocking dev-server
      // start) plus a debounced re-run on relevant source changes (design doc
      // 2026-07-08-dev-dashboard-whole-project-design.md). Failures are warned and the
      // previous static layer (if any) is kept — the dashboard falls back to live-only.
      const runner = createAnalysisRunner({
        root: uiRoot,
        treatDynamicAs: options.treatDynamicAs,
        metaComponents: options.metaComponents,
        rules: options.rules,
        failOn: options.failOn,
        onResults: (results) => store.setStatic(results),
        onError: (err) => console.warn('[svelte-vitals] dev analysis failed:', err),
        onStatusChange: (analyzing) => store.setAnalyzing(analyzing)
      });
      runner.start();
      server.watcher?.on('all', (_event, file) => {
        if (isRelevant(file, uiRoot)) runner.notifyChange(file);
      });

      // Clear the flag and stop the runner when the dev server stops, so the handle
      // doesn't keep POSTing to a no-longer-mounted endpoint after a restart / config
      // flip, and no re-analysis timer outlives the server.
      server.httpServer?.once('close', () => {
        delete process.env.SVELTE_VITALS_UI;
        runner.stop();
      });

      installUiMiddleware(server, config, readPackageVersion(), store, readCoreVersion());

      // The dashboard has no separate CLI entry point (unlike `vitest --ui`) to signal
      // it exists, so announce it the same way Vite announces its own dev server: as an
      // extra line appended after Vite's own "Local:/Network:" URL block. Wrapping
      // printUrls (rather than logging eagerly here) means the line only appears once
      // the server is actually listening and prints in the same place a developer's eyes
      // already are on every `vite dev` start.
      if (typeof server.printUrls === 'function') {
        const printUrls = server.printUrls.bind(server);
        server.printUrls = () => {
          printUrls();
          const printed = server.resolvedUrls?.local?.[0] ?? server.resolvedUrls?.network?.[0];
          if (printed) {
            // installUiMiddleware always mounts at the server root ('/__svelte-vitals'),
            // regardless of a configured `base` — a non-root base makes Vite print a URL
            // with a path segment (e.g. http://host:5173/my-app/), so resolving
            // '__svelte-vitals/' relative to that would announce the wrong, 404ing URL.
            // Use the origin only and always append the root-mounted path ourselves.
            console.log(`  ➜  svelte-vitals: ${new URL(printed).origin}/__svelte-vitals/`);
          }
        };
      }
    }
  };
  return [buildPlugin, uiPlugin];
}
