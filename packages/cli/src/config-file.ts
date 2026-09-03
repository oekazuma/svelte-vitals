import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Category, Config, RuleOptions, RuleOverride } from '@svelte-vitals/core';
import { CATEGORIES } from '@svelte-vitals/core';
import {
  defaultConfig,
  resolveRuleOptions,
  shouldSkipRangeCheck,
  validateRuleSetting
} from '@svelte-vitals/core/internal';
import { findUnknownRuleIds, knownRuleIds, registryTag, ruleOptionsSpec } from './rules-config.js';

/**
 * Loads `svelte-vitals.config.{js,ts}` from the analyzed directory (design
 * doc: docs/superpowers/specs/2026-07-05-config-file-design.md). Wired into
 * `analyzeProject` (packages/cli/src/index.ts), so every caller of it inherits
 * the config file.
 *
 * Candidate filenames, in priority order. Only `cwd` itself is searched (no
 * upward directory walk — see design doc §1). Exported so the install wizard's
 * config-file scaffolder (install/config-file-format.ts) detects existing
 * configs against the exact same list — a second hand-maintained copy could
 * drift and make the scaffolder create a duplicate config the loader then
 * shadows or ignores.
 */
export const CONFIG_FILENAMES = ['svelte-vitals.config.js', 'svelte-vitals.config.ts'];

/** The extension set `--config` accepts — derived so it cannot drift from discovery's list. */
const CONFIG_EXTENSIONS = CONFIG_FILENAMES.map((name) => name.slice(name.lastIndexOf('.')));

const TREAT_DYNAMIC_AS_VALUES = ['pass', 'warn', 'fail'];
const FAIL_ON_VALUES = ['critical', 'warning', 'info'];
const KNOWN_TOP_LEVEL_KEYS = new Set(['treatDynamicAs', 'metaComponents', 'rules', 'failOn', 'weights', 'overrides']);

/** Whether `value` is a plain object (not null, not an array) — usable with Object.keys/entries. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Result of loading and validating a config file. */
export interface LoadedConfigFile {
  /** The file's contents after validation; invalid optional fields are dropped (see `warnings`). */
  config: Partial<Config>;
  /** Non-fatal issues: unknown top-level keys, invalid enum values (the field is ignored). */
  warnings: string[];
}

/**
 * Validate one rule setting — the bare severity string or the object form — and
 * throw on the first problem, prefixed with the config file's path. The rules
 * themselves live in core's `validateRuleSetting`, shared with the Vite plugin's
 * `rules`/`overrides` options so a config file and the equivalent plugin option
 * can't be judged differently. Everything is fatal, on the same reasoning as
 * unknown rule ids — a typo that silently leaves the config inert is the failure
 * being prevented.
 *
 * `baseline`, when given, is the already-resolved options this setting's
 * `options` would be merged onto at run time — the global `rules[id].options`
 * layer, for a setting that lives in `overrides[].rules` (design 2026-07-26
 * review, Finding A). Omitted for the global `rules` layer itself, so its
 * min/max cross-check falls back to the rule's own built-in default.
 */
function validateSetting(
  path: string,
  where: string,
  key: string,
  setting: unknown,
  allowOptions: boolean,
  baseline?: RuleOptions,
  skipRangeCheck?: boolean
): void {
  const errors = validateRuleSetting(`${where}.${key}`, key, setting, ruleOptionsSpec(key), {
    allowOptions,
    ...(baseline !== undefined ? { baseline } : {}),
    ...(skipRangeCheck !== undefined ? { skipRangeCheck } : {})
  });
  if (errors.length > 0) throw new Error(`${path}: ${errors.join(' ')}`);
}

/**
 * Validate a config file's default export (design doc §4):
 *
 * - **Fatal (thrown)**: unknown rule ids in `rules` (reuses `findUnknownRuleIds`
 *   / `knownRuleIds`, same message shape as the `--rules`/`--ignore` error);
 *   unknown category keys or negative/non-finite values in `weights`; an
 *   invalid rule setting (string or object form) or invalid rule options,
 *   in both `rules` and `overrides[].rules` (see `validateSetting`).
 * - **Warning (returned, field dropped)**: invalid enum values for
 *   `treatDynamicAs` / `failOn`; unknown top-level keys (forward-compatibility).
 */
function validateConfigFile(raw: Record<string, unknown>, path: string): LoadedConfigFile {
  const warnings: string[] = [];
  const config: Partial<Config> = {};

  for (const key of Object.keys(raw)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
      warnings.push(`${path}: unknown config key '${key}' ignored.`);
    }
  }

  if (raw.treatDynamicAs !== undefined) {
    if (TREAT_DYNAMIC_AS_VALUES.includes(raw.treatDynamicAs as string)) {
      config.treatDynamicAs = raw.treatDynamicAs as Config['treatDynamicAs'];
    } else {
      warnings.push(
        `${path}: unknown treatDynamicAs '${String(raw.treatDynamicAs)}'; expected pass|warn|fail. Ignoring.`
      );
    }
  }

  if (raw.failOn !== undefined) {
    if (FAIL_ON_VALUES.includes(raw.failOn as string)) {
      config.failOn = raw.failOn as Config['failOn'];
    } else {
      warnings.push(`${path}: unknown failOn '${String(raw.failOn)}'; expected critical|warning|info. Ignoring.`);
    }
  }

  if (raw.metaComponents !== undefined) {
    if (Array.isArray(raw.metaComponents) && raw.metaComponents.every((c) => typeof c === 'string')) {
      config.metaComponents = raw.metaComponents as string[];
    } else {
      warnings.push(`${path}: metaComponents must be an array of strings. Ignoring.`);
    }
  }

  if (raw.rules !== undefined) {
    if (!isPlainObject(raw.rules)) {
      throw new Error(`${path}: rules must be an object of rule-id → setting.`);
    }
    const rules = raw.rules as Config['rules'];
    const unknown = findUnknownRuleIds(Object.keys(rules));
    if (unknown.length > 0) {
      throw new Error(
        `${path}: unknown rule id(s) in rules: ${unknown.join(', ')}. Known rule ids (${registryTag()}): ${knownRuleIds().join(', ')}`
      );
    }
    for (const [key, setting] of Object.entries(rules)) validateSetting(path, 'rules', key, setting, true);
    config.rules = rules;
  }

  if (raw.overrides !== undefined) {
    if (!Array.isArray(raw.overrides)) {
      throw new Error(`${path}: overrides must be an array of { route/files, rules } entries.`);
    }
    // Empty globs compile to a never-matching pattern, so an entry carrying one
    // would silently do nothing — reject alongside the other shape errors.
    const isGlob = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
    const isGlobs = (v: unknown): v is RuleOverride['route'] =>
      isGlob(v) || (Array.isArray(v) && v.length > 0 && v.every(isGlob));
    const overrides: RuleOverride[] = [];
    const rawOverrides = raw.overrides; // narrowed to an array by the check above
    rawOverrides.forEach((entry: unknown, i: number) => {
      if (!isPlainObject(entry)) {
        throw new Error(`${path}: overrides[${i}] must be an object with 'route' and/or 'files', and 'rules'.`);
      }
      if (entry.route !== undefined && !isGlobs(entry.route)) {
        throw new Error(
          `${path}: overrides[${i}].route must be a non-empty string or a non-empty array of non-empty strings.`
        );
      }
      if (entry.files !== undefined && !isGlobs(entry.files)) {
        throw new Error(
          `${path}: overrides[${i}].files must be a non-empty string or a non-empty array of non-empty strings.`
        );
      }
      if (entry.route === undefined && entry.files === undefined) {
        throw new Error(`${path}: overrides[${i}] must set 'route' and/or 'files' to scope the override.`);
      }
      if (!isPlainObject(entry.rules)) {
        throw new Error(`${path}: overrides[${i}].rules must be an object of rule-id/category → setting.`);
      }
      if (Object.keys(entry.rules).length === 0) {
        throw new Error(`${path}: overrides[${i}].rules must contain at least one rule id or category.`);
      }
      // Keys may be rule ids or category names; reject anything else so a typo
      // can't silently leave a route gated (or un-gated) — same stance as `rules`.
      const nonCategoryKeys = Object.keys(entry.rules).filter((k) => !CATEGORIES.includes(k as Category));
      const unknown = findUnknownRuleIds(nonCategoryKeys);
      if (unknown.length > 0) {
        throw new Error(
          `${path}: unknown rule id(s) or categories in overrides[${i}].rules: ${unknown.join(', ')}. ` +
            `Known categories: ${CATEGORIES.join(', ')}. Known rule ids (${registryTag()}): ${knownRuleIds().join(', ')}`
        );
      }
      for (const [key, setting] of Object.entries(entry.rules)) {
        const isCategory = CATEGORIES.includes(key as Category);
        // The baseline this override entry's options merge onto at run time: built-in
        // defaults plus the global `rules[key].options` layer (no other override
        // entries — which ones apply depends on the target, unknowable here). Category
        // keys never carry options, so they need no baseline.
        const baseline = isCategory
          ? undefined
          : resolveRuleOptions(key, ruleOptionsSpec(key), { ...defaultConfig, rules: config.rules ?? {} });
        // If this entry narrows only one side of a min/max range, and some other
        // overrides[] entry narrows the opposite side, `baseline` above can't be
        // trusted to judge this entry alone — the shared helper skips the
        // cross-check rather than risk rejecting a config that is valid at every
        // target it actually applies to (design 2026-07-26 review, Finding A,
        // third pass).
        const skipRangeCheck = shouldSkipRangeCheck(rawOverrides, i, key, setting);
        validateSetting(path, `overrides[${i}].rules`, key, setting, !isCategory, baseline, skipRangeCheck);
      }
      overrides.push({
        ...(entry.route !== undefined ? { route: entry.route as RuleOverride['route'] } : {}),
        ...(entry.files !== undefined ? { files: entry.files as RuleOverride['files'] } : {}),
        rules: entry.rules as RuleOverride['rules']
      });
    });
    config.overrides = overrides;
  }

  if (raw.weights !== undefined) {
    if (!isPlainObject(raw.weights)) {
      throw new Error(`${path}: weights must be an object of category → number.`);
    }
    const weights: Partial<Record<Category, number>> = {};
    for (const [rawCat, w] of Object.entries(raw.weights)) {
      // Category keys are accepted case-insensitively, matching --weights.
      const cat = rawCat.toLowerCase();
      if (!CATEGORIES.includes(cat as Category)) {
        throw new Error(`${path}: unknown category '${rawCat}' in weights. Known categories: ${CATEGORIES.join(', ')}`);
      }
      if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) {
        throw new Error(`${path}: invalid weight for '${cat}': ${String(w)}; expected a finite number >= 0.`);
      }
      weights[cat as Category] = w;
    }
    config.weights = weights;
  }

  return { config, warnings };
}

/**
 * Find and load `svelte-vitals.config.{js,ts}` from `cwd` (only `cwd`, no
 * upward search). Returns `undefined` when no candidate file exists.
 *
 * Loader mechanism (design doc §2): plain native `import()`. `.js` is parsed as
 * ESM (the project must be `"type": "module"` — SvelteKit's default); `.ts`
 * loads via native type-stripping, unflagged on every supported Node
 * (engines.node >=24.16.0).
 *
 * Throws when: the file exists but has no usable default export, or the loaded
 * config fails validation (unknown rule ids in `rules`, invalid `weights`
 * entries).
 */
export async function loadConfigFile(cwd: string): Promise<LoadedConfigFile | undefined> {
  const found = CONFIG_FILENAMES.map((name) => join(cwd, name)).find((path) => existsSync(path));
  if (!found) {
    // Migration tripwire: `.mjs` was the default scaffold extension before the loader
    // narrowed to {js,ts} — running with silent defaults would un-gate CI without a trace,
    // so a leftover .mjs fails loudly instead.
    const retired = join(cwd, 'svelte-vitals.config.mjs');
    if (existsSync(retired)) {
      throw new Error(
        `${retired} is no longer read — svelte-vitals loads svelte-vitals.config.{js,ts} only. ` +
          'Rename the file to .js (the project must be "type": "module") or .ts.'
      );
    }
    return undefined;
  }
  return loadFrom(found);
}

/**
 * Load and validate a config file the caller named (`--config`) instead of one discovered in
 * `cwd`. Same loader, same validation; the difference is what absence means — the caller chose
 * this file, so a missing one is fatal where a missing discovered file is simply "no config".
 * The extension is checked first, and before the disk is touched: discovery narrowed to
 * `{js,ts}` and kept a loud tripwire for `.mjs`, and a by-path loader that went straight to
 * `import()` would quietly accept the file that tripwire exists to reject.
 */
export async function loadConfigFromPath(path: string): Promise<LoadedConfigFile> {
  if (!CONFIG_EXTENSIONS.some((ext) => path.endsWith(ext))) {
    throw new Error(
      `${path} is not a supported config file — svelte-vitals loads ${CONFIG_EXTENSIONS.join(' and ')} only.`
    );
  }
  if (!existsSync(path)) throw new Error(`${path} does not exist.`);
  return loadFrom(path);
}

/** Import one known-present config file and validate it. Shared by discovery and `--config`. */
async function loadFrom(path: string): Promise<LoadedConfigFile> {
  let mod: { default?: unknown };
  try {
    // Node's ESM loader caches modules by URL for the life of the process, so a long-lived
    // host (the vite dev dashboard re-analyzes on every save) would keep serving the config as
    // it was first loaded. A content hash in the query re-evaluates only when the file actually
    // changed; an unchanged file keeps hitting the cache instead of leaking a module per run.
    // Modules the config itself imports are still cached — that is a documented limitation.
    const digest = createHash('sha1').update(readFileSync(path)).digest('hex').slice(0, 16);
    mod = (await import(`${pathToFileURL(path).href}?v=${digest}`)) as { default?: unknown };
  } catch (err) {
    // A .js config in CJS scope is parsed as CJS, so its `export default` is a SyntaxError
    // that names neither the file nor the fix — rethrow with both. A typo in an ESM config
    // lands here too, and bin.ts prints only `message`, so Node's own text has to stay in
    // front of the hint or the typo becomes undiagnosable. Only a bare `node` can reach this
    // (vitest's module runner transforms in-process `import()`), so the assertion lives in
    // scripts/floor-smoke.js. The hint names the package.json nearest the config file, not
    // "the project": a `--config` file can live outside the project tree, where the project's
    // own package.json does not govern it.
    if (path.endsWith('.js') && err instanceof SyntaxError) {
      throw new Error(
        `could not load ${path}: ${err.message} — config files are ESM, so the nearest ` +
          'package.json above the config file needs "type": "module" (SvelteKit\'s default), ' +
          'or use a .ts config.',
        { cause: err }
      );
    }
    throw err;
  }

  if (!isPlainObject(mod.default)) {
    throw new Error(
      `${path} must have a default export that is a plain object (e.g. \`export default defineConfig({...})\` or a plain object literal).`
    );
  }

  return validateConfigFile(mod.default as Record<string, unknown>, path);
}
