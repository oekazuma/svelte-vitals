import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Category, Config, RuleOptions, RuleOverride } from '@svelte-vitals/core';
import {
  CATEGORIES,
  defaultConfig,
  resolveRuleOptions,
  shouldSkipRangeCheck,
  validateRuleSetting
} from '@svelte-vitals/core';
import { findUnknownRuleIds, knownRuleIds, ruleOptionsSpec } from './rules-config.js';

/**
 * Loads `svelte-vitals.config.{mjs,js,ts}` from the analyzed directory (design
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
export const CONFIG_FILENAMES = ['svelte-vitals.config.mjs', 'svelte-vitals.config.js', 'svelte-vitals.config.ts'];

const TREAT_DYNAMIC_AS_VALUES = ['pass', 'warn', 'fail'];
const FAIL_ON_VALUES = ['critical', 'warning', 'info'];
const KNOWN_TOP_LEVEL_KEYS = new Set(['treatDynamicAs', 'metaComponents', 'rules', 'failOn', 'weights', 'overrides']);

/** Whether `value` is a plain object (not null, not an array) — usable with Object.keys/entries. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissingExtensionLoaderError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (('code' in err && (err as NodeJS.ErrnoException).code === 'ERR_UNKNOWN_FILE_EXTENSION') ||
      /Unknown file extension/.test(err.message))
  );
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
        `${path}: unknown rule id(s) in rules: ${unknown.join(', ')}. Known rule ids: ${knownRuleIds().join(', ')}`
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
            `Known categories: ${CATEGORIES.join(', ')}. Known rule ids: ${knownRuleIds().join(', ')}`
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
 * Find and load `svelte-vitals.config.{mjs,js,ts}` from `cwd` (only `cwd`, no
 * upward search). Returns `undefined` when no candidate file exists.
 *
 * Loader mechanism (design doc §2): plain native `import()`. `.mjs`/`.js` always
 * work (zero dependencies, no Node-version dependency). `.ts` depends on the host
 * Node's TypeScript type-stripping support: unflagged in Node 23.6.0, backported
 * to 22.18.0; on 22.13–22.17 (this repo's floor is >=22.13.0) it requires
 * `--experimental-strip-types` and otherwise fails with
 * `ERR_UNKNOWN_FILE_EXTENSION` — this is caught here and rethrown as a
 * descriptive, actionable error instead of surfacing Node's raw error.
 *
 * Throws when: the file exists but has no usable default export; (`.ts` only)
 * the host Node can't load TypeScript without a flag; or the loaded config
 * fails validation (unknown rule ids in `rules`, invalid `weights` entries).
 */
export async function loadConfigFile(cwd: string): Promise<LoadedConfigFile | undefined> {
  const found = CONFIG_FILENAMES.map((name) => join(cwd, name)).find((path) => existsSync(path));
  if (!found) return undefined;

  let mod: { default?: unknown };
  try {
    mod = (await import(pathToFileURL(found).href)) as { default?: unknown };
  } catch (err) {
    if (found.endsWith('.ts') && isMissingExtensionLoaderError(err)) {
      throw new Error(
        `could not load ${found} — this Node runtime does not support TypeScript config ` +
          'files without a flag. Native type-stripping is unflagged from Node 22.18 / 23.6+: upgrade Node ' +
          'to 22.18+, re-run with --experimental-strip-types, or rename the file to .mjs/.js.',
        { cause: err }
      );
    }
    throw err;
  }

  if (!isPlainObject(mod.default)) {
    throw new Error(
      `${found} must have a default export that is a plain object (e.g. \`export default defineConfig({...})\` or a plain object literal).`
    );
  }

  return validateConfigFile(mod.default as Record<string, unknown>, found);
}
