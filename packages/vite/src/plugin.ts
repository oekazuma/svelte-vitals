import { existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, isAbsolute, dirname, relative, basename, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import type {
  Category,
  Config,
  RuleOptions,
  RuleOverride,
  RuleSetting,
  Severity,
  TreatDynamicAs
} from '@svelte-vitals/core';
import { CATEGORIES } from '@svelte-vitals/core';
import {
  defaultConfig,
  resolveRuleOptions,
  shouldSkipRangeCheck,
  terminalSafe,
  validateRuleSetting
} from '@svelte-vitals/core/internal';
import { CONFIG_FILENAMES, findUnknownRuleIds, knownRuleIds, registryTag, ruleOptionsSpec } from 'svelte-vitals';
import { analyze, mergeConfig, resolveConfig } from './analyze.js';
import { resolveMinifyDisabled } from './minify-flag.js';
import { installUiMiddleware } from './ui/middleware.js';
import { createStore } from './ui/store.js';
import { createAnalysisRunner } from './ui/analysis.js';
import { readPackageVersion, readCoreVersion } from './version.js';

const CONFIG_BASENAMES = new Set([
  'svelte.config.js',
  'svelte.config.ts',
  // The svelte-vitals config names come from the CLI's own loader list, so the watcher
  // can never drift from what analyze() actually loads.
  ...CONFIG_FILENAMES,
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
  'vite.config.cjs',
  'vite.config.mts',
  'vite.config.cts'
]);

const IGNORED_SEGMENTS = new Set(['node_modules', '.svelte-kit', 'build', 'dist']);

/** Analyzed-repo-derived strings (rule messages, config warnings) can carry raw terminal escapes — sanitize at this sink boundary, not per interpolation. */
const warn = (line: string): void => console.warn(terminalSafe(line));

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

/**
 * Validate the plugin's `rules` option the same way the CLI's config-file loader
 * validates a config file's `rules` map (design 2026-07-26, Finding 4): an unknown
 * rule id, an invalid `severity`, an unrecognized key in the object form, or an
 * unknown/mistyped/out-of-range option is fatal, not silently dropped.
 * `options.rules` never passes through `loadConfigFile` (that only validates
 * `svelte-vitals.config.*`), so this is the only check a plugin-option `rules`
 * value gets. Unknown ids are rejected first — as the CLI does — so a typo'd id
 * with options reports "unknown rule id", not a misleading "takes no options"
 * (2026-07-26 second review, Finding D). The setting shape itself is checked by
 * core's `validateRuleSetting`, shared with the CLI loader: TypeScript already
 * catches a bad severity for TS consumers, but a `vite.config.js` gets no such
 * help, and a silently-inert typo is the failure this whole check exists for.
 */
function validateRulesOption(rules: Record<string, RuleSetting> | undefined): void {
  if (!rules) return;
  const unknown = findUnknownRuleIds(Object.keys(rules));
  if (unknown.length > 0) {
    throw new Error(
      `svelte-vitals: invalid \`rules\` option — unknown rule id(s): ${unknown.join(', ')}. ` +
        `Known rule ids (${registryTag()}): ${knownRuleIds().join(', ')}`
    );
  }
  const errors: string[] = [];
  for (const [id, setting] of Object.entries(rules)) {
    errors.push(...validateRuleSetting(`rules.${id}`, id, setting, ruleOptionsSpec(id), { allowOptions: true }));
  }
  if (errors.length > 0) throw new Error(`svelte-vitals: invalid \`rules\` option — ${errors.join(' ')}`);
}

/**
 * Validate the plugin's `overrides` option (2026-07-26 second review, Finding C):
 * previously only `options.rules` was validated, so a typo inside
 * `overrides[].rules[id].options` — the field the changeset advertises as the
 * per-path home for options — silently dropped the option instead of failing
 * loudly. Same fatal/known-id/carve-out rules as the CLI's config-file loader
 * (both funnel through core's `validateRuleSetting`): unknown rule ids (rejected
 * before options, per Finding D) or categories are fatal; a category key may
 * carry a severity but never `options`; a rule-id key's options are validated
 * against the baseline resolved from `rules`, so an override that only narrows
 * one side of an already-widened range isn't falsely rejected (Finding A) —
 * including when the widening comes from another `overrides[]` entry rather than
 * the global `rules` layer (Finding A, third pass; see `shouldSkipRangeCheck`).
 *
 * `rulesLayerKnown` is false when the plugin got no `rules` option: `analyze()`
 * then resolves the global layer from `svelte-vitals.config.*` instead
 * (per-field precedence, `analyze.ts`), and that file can only be read
 * asynchronously — after this synchronous construction-time check. A config file
 * widening `max` while an override narrows `min` is a valid combination, so
 * judging the override against the built-in default alone would hard-fail a
 * `vite build` over a config that is correct at run time. The min/max
 * cross-check is therefore skipped in that case; every other check (unknown id,
 * unknown key, type, bounds) is unaffected, and `analyze()` still validates the
 * config file itself through `loadConfigFile`.
 */
function validateOverridesOption(
  overrides: RuleOverride[] | undefined,
  rules: Record<string, RuleSetting> | undefined
): void {
  if (!overrides) return;
  const rulesLayerKnown = rules !== undefined;
  const baseConfig = { ...defaultConfig, rules: rules ?? {} };
  const errors: string[] = [];
  overrides.forEach((entry, i) => {
    const entryRules = entry.rules ?? {};
    const nonCategoryKeys = Object.keys(entryRules).filter((k) => !CATEGORIES.includes(k as Category));
    const unknown = findUnknownRuleIds(nonCategoryKeys);
    if (unknown.length > 0) {
      throw new Error(
        `svelte-vitals: invalid \`overrides\` option — overrides[${i}]: unknown rule id(s) or categories: ` +
          `${unknown.join(', ')}. Known categories: ${CATEGORIES.join(', ')}. ` +
          `Known rule ids (${registryTag()}): ${knownRuleIds().join(', ')}`
      );
    }
    for (const [key, setting] of Object.entries(entryRules)) {
      const isCategory = CATEGORIES.includes(key as Category);
      const baseline: RuleOptions | undefined = isCategory
        ? undefined
        : resolveRuleOptions(key, ruleOptionsSpec(key), baseConfig);
      errors.push(
        ...validateRuleSetting(`overrides[${i}].rules.${key}`, key, setting, ruleOptionsSpec(key), {
          allowOptions: !isCategory,
          ...(baseline !== undefined ? { baseline } : {}),
          skipRangeCheck: !rulesLayerKnown || shouldSkipRangeCheck(overrides, i, key, setting)
        })
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
  let minify: unknown;
  let configFile: string | undefined;
  const buildPlugin: Plugin = {
    name: 'svelte-vitals',
    apply: 'build',
    enforce: 'post',
    config(userConfig) {
      // Read the user's value here, not the resolved one: SvelteKit runs `vite build` as an
      // SSR build whose resolved `build.minify` is forced to false, and its client build is a
      // separate `vite.build({ configFile })` with a fresh plugin instance — so the instance
      // whose closeBundle sees the prerendered dir never gets a client `configResolved`.
      // This is the same source SvelteKit itself forwards to the client build.
      minify = userConfig.build?.minify;
    },
    configResolved(config) {
      if (!options.cwd) root = config.root;
      configFile = config.configFile;
    },
    async closeBundle() {
      const pagesDir = options.prerenderDir ? options.prerenderDir : join(root, DEFAULT_PRERENDER_DIR);
      const resolved = isAbsolute(pagesDir) ? pagesDir : join(root, pagesDir);

      // SvelteKit calls closeBundle TWICE: once during the JS bundle phase
      // (before prerendering, dir absent) and once after the adapter writes
      // prerendered HTML (Task 2 spike). Skip the early/empty invocation so we
      // don't emit a spurious "0 routes" report or gate on nothing.
      if (!existsSync(resolved)) return;

      // Resolved OUTSIDE the try: a config-file validation error must fail the
      // build (same stance as the CLI's exit 2) — the catch below is only for
      // the analysis itself (unreadable output, glob errors), not for config errors.
      const resolvedConfig = await resolveConfig(root, options);

      let result;
      try {
        const viteMinifyDisabled = await resolveMinifyDisabled(minify, configFile, root);
        result = await analyze(
          resolved,
          root,
          options,
          viteMinifyDisabled ? { viteMinifyDisabled } : undefined,
          resolvedConfig
        );
      } catch (err) {
        // The analysis itself failed (unreadable/malformed output, glob error,
        // …). That's our problem, not a real SEO finding, so warn and skip the
        // gate instead of failing the whole build — distinct from `result.failed`.
        // Config-file validation errors never reach here: resolved above, before
        // the try, they propagate and fail the build instead.
        warn(`svelte-vitals: skipped — analysis failed: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
      for (const w of result.warnings) warn(`svelte-vitals: ${w}`);
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

      // This `config` drives the dashboard's rendering/scoring (installUiMiddleware →
      // buildSnapshot → buildJsonReport) — the whole-project `runner` below gets its
      // config-file values independently, since it calls analyzeProject (which loads
      // the config file itself).
      let config: Config;
      // Config-file warnings already printed here for this edit — the runner below
      // reloads the same config file itself and must not print them a second time.
      let printedConfigWarnings = new Set<string>();

      // Guards a stale resolve from clobbering a newer one when two watcher-driven
      // calls overlap (the debounce below makes this rare but not impossible: a
      // resolve can still be in flight when the timer fires again).
      let configGeneration = 0;

      // Shared by startup and the config-file watcher below: an invalid config must
      // never take the dev server down, so a failed re-resolve keeps whatever config
      // the dashboard was already using.
      const applyConfig = async (): Promise<void> => {
        const generation = ++configGeneration;
        try {
          const resolved = await resolveConfig(uiRoot, options);
          if (generation !== configGeneration) return;
          config = resolved.config;
          // Replaced, not accumulated: an edit that fixes a warning must let a later,
          // unrelated warning with the same text print again.
          printedConfigWarnings = new Set(resolved.warnings);
          for (const w of resolved.warnings) warn(`svelte-vitals: ${w}`);
        } catch (err) {
          if (generation !== configGeneration) return;
          // Dev must not crash on a config typo; the dashboard runs on plugin
          // options/defaults (or the previous config, on a later edit) and says so.
          // The build path (closeBundle) intentionally DOES fail — see the comment there.
          warn(
            `svelte-vitals: config file invalid — dashboard using ${config ? 'the previous config' : 'plugin options/defaults'}: ${err instanceof Error ? err.message : String(err)}`
          );
          config ??= mergeConfig(options, undefined);
        }
      };
      await applyConfig();
      const store = createStore();

      // The whole-project runner's crashed-rule ids, read by installUiMiddleware on every
      // request via the getter below — a plain variable would only ever see the value at
      // configureServer time, not later re-runs. Ids only, not a config: `config` above
      // (carrying plugin-option weights/overrides) must stay the scoring base always.
      let staticFailedRuleIds: string[] = [];

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
        onResults: (results, failedRuleIds) => {
          store.setStatic(results);
          staticFailedRuleIds = failedRuleIds ?? [];
        },
        onError: (err) =>
          warn(`svelte-vitals: dev analysis failed: ${err instanceof Error ? err.message : String(err)}`),
        // Same sink and prefix as the build path (closeBundle) so the two never read differently.
        // The runner reloads the config file itself, so its warning set repeats whatever
        // applyConfig already printed for this edit — skip those to avoid printing twice.
        onWarnings: (warnings) => {
          for (const w of warnings) if (!printedConfigWarnings.has(w)) warn(`svelte-vitals: ${w}`);
        },
        onStatusChange: (analyzing) => store.setAnalyzing(analyzing)
      });
      runner.start();

      // A save-by-truncate editor delivers a 'change' event while the file is
      // half-written, which would make an immediate re-resolve throw on the partial
      // content and print a false "config file invalid" warning. Debouncing (500ms,
      // mirroring the runner's own default debounce in ui/analysis.ts) lets a burst
      // of events settle on the final write before resolving once.
      let configTimer: ReturnType<typeof setTimeout> | undefined;
      server.watcher?.on('all', (_event, file) => {
        if (!isRelevant(file, uiRoot)) return;
        // The runner re-loads the config file itself (analyzeProject → loadConfigFile); the
        // dashboard's scoring config is resolved here, so it has to follow the same edit.
        if (CONFIG_FILENAMES.includes(basename(file))) {
          clearTimeout(configTimer);
          configTimer = setTimeout(() => void applyConfig(), 500);
        }
        runner.notifyChange(file);
      });

      // Clear the flag and stop the runner when the dev server stops, so the handle
      // doesn't keep POSTing to a no-longer-mounted endpoint after a restart / config
      // flip, and no re-analysis timer outlives the server.
      server.httpServer?.once('close', () => {
        delete process.env.SVELTE_VITALS_UI;
        clearTimeout(configTimer);
        runner.stop();
      });

      installUiMiddleware(
        server,
        () => config,
        readPackageVersion(),
        store,
        readCoreVersion(),
        () => staticFailedRuleIds
      );

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
