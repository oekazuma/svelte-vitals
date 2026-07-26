/**
 * Per-rule options: their declaration, resolution, and validation (design
 * 2026-07-26). Deliberately does not import `rule.ts` — `rule.ts` imports
 * `RuleOptionsSpec` from here, so taking `Rule` as a parameter would cycle.
 * Callers pass the id and the spec instead.
 */
import type { Config, RuleOptions } from './types.js';
import { compileOverrides, overrideMatches, settingOptions, type CompiledOverride } from './config-apply.js';

/**
 * One configurable option. `kind` decides the merge semantics, so no rule
 * writes merge code of its own: `integer` replaces, and the two collection
 * kinds ADD to the built-in default (never replace — see the design doc).
 */
export type RuleOptionSpec =
  | { kind: 'integer'; default: number; min?: number; max?: number }
  | { kind: 'string-list'; default: readonly string[] }
  | { kind: 'string-map'; default: Readonly<Record<string, string>> };

/** A rule's configurable options, keyed by option name. */
export type RuleOptionsSpec = Record<string, RuleOptionSpec>;

function defaultsOf(spec: RuleOptionsSpec): RuleOptions {
  const out: RuleOptions = {};
  for (const [key, s] of Object.entries(spec)) {
    // Copy the collections — a caller must never be able to mutate a rule's defaults.
    out[key] = s.kind === 'integer' ? s.default : s.kind === 'string-list' ? [...s.default] : { ...s.default };
  }
  return out;
}

/**
 * Effective options for a rule at a target: built-in defaults, then
 * `config.rules[ruleId].options`, then every matching `config.overrides` entry
 * in order. Integers take the last value; lists and maps accumulate.
 *
 * `target` omitted skips overrides entirely (project-scoped rules). Callers
 * resolving many targets should hoist `compileOverrides(config)` and pass it as
 * `compiled` — otherwise every call recompiles the globs.
 */
export function resolveRuleOptions(
  ruleId: string,
  spec: RuleOptionsSpec | undefined,
  config: Config,
  target?: { route?: string; file?: string },
  compiled?: CompiledOverride[]
): RuleOptions {
  if (!spec) return {};
  const out = defaultsOf(spec);

  const layers: (RuleOptions | undefined)[] = [settingOptions(config.rules[ruleId])];
  if (target) {
    for (const o of compiled ?? compileOverrides(config)) {
      // Rule id only: a category key can carry a severity but never options.
      if (overrideMatches(o, target)) layers.push(settingOptions(o.rules[ruleId]));
    }
  }

  for (const layer of layers) {
    if (!layer) continue;
    for (const [key, value] of Object.entries(layer)) {
      const s = spec[key];
      if (!s) continue; // validation rejects unknown keys up front; ignore defensively
      if (s.kind === 'integer') out[key] = value;
      else if (s.kind === 'string-list') out[key] = [...(out[key] as string[]), ...(value as string[])];
      else out[key] = { ...(out[key] as Record<string, string>), ...(value as Record<string, string>) };
    }
  }
  return out;
}

/**
 * Problems with a user-supplied options object, as human-readable sentences
 * (empty = valid). Callers treat any result as fatal: a typo that silently
 * leaves the config inert is the failure this exists to prevent.
 *
 * `baseline`, when given, is the already-resolved value this `options` layer
 * is being merged onto — built-in defaults merged with any earlier layer(s)
 * (e.g. the global `config.rules[id].options`, when `options` is an
 * `overrides[]` entry). The min/max cross-check below compares against it
 * instead of the spec's own default, so a layer that only sets one side of a
 * range is checked against what it actually inherits (design 2026-07-26
 * review, Finding A). Omit it to check `options` against the spec defaults
 * alone, as when validating the global layer itself.
 */
export function validateRuleOptions(
  ruleId: string,
  spec: RuleOptionsSpec | undefined,
  options: RuleOptions,
  baseline?: RuleOptions
): string[] {
  if (!spec) return [`${ruleId} takes no options.`];
  const errors: string[] = [];
  // Tracks which option keys already have a type/bounds error, so the cross-
  // check below can skip only when min/max itself is unreliable — an
  // unrelated error (e.g. an unknown key) must not hide a real range problem
  // (Finding B).
  const badKeys = new Set<string>();
  const isNonEmptyString = (v: unknown): boolean => typeof v === 'string' && v.length > 0;

  for (const [key, value] of Object.entries(options)) {
    const s = spec[key];
    if (!s) {
      errors.push(`${ruleId}: unknown option '${key}'. Known options: ${Object.keys(spec).join(', ')}.`);
      continue;
    }
    if (s.kind === 'integer') {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        errors.push(`${ruleId}.${key} must be an integer.`);
        badKeys.add(key);
      } else if (s.min !== undefined && value < s.min) {
        errors.push(`${ruleId}.${key} must be >= ${s.min}.`);
        badKeys.add(key);
      } else if (s.max !== undefined && value > s.max) {
        errors.push(`${ruleId}.${key} must be <= ${s.max}.`);
        badKeys.add(key);
      }
    } else if (s.kind === 'string-list') {
      if (!Array.isArray(value) || !value.every(isNonEmptyString)) {
        errors.push(`${ruleId}.${key} must be an array of non-empty strings.`);
      }
    } else if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      !Object.values(value).every(isNonEmptyString)
    ) {
      errors.push(`${ruleId}.${key} must be an object of string → non-empty string.`);
    }
  }

  // Cross-field: a rule that declares both an integer `min` and `max` (the length
  // rules) must not end up with an inverted EFFECTIVE range. Each side falls back
  // to `baseline` (or the spec's own default, when no baseline is given) when this
  // layer's `options` doesn't set it — so a config that only sets one side (e.g.
  // `{ min: 100 }`) is checked against what it actually inherits, not blindly
  // against the built-in default of the other side. This is the only case that
  // fires for both the CLI config-file loader and the Vite plugin (Finding 3/4),
  // since both funnel through this function.
  const minSpec = spec.min;
  const maxSpec = spec.max;
  if (minSpec?.kind === 'integer' && maxSpec?.kind === 'integer' && !badKeys.has('min') && !badKeys.has('max')) {
    const base = baseline ?? defaultsOf(spec);
    const minVal = 'min' in options ? (options.min as number) : (base.min as number);
    const maxVal = 'max' in options ? (options.max as number) : (base.max as number);
    if (minVal > maxVal) errors.push(`${ruleId}: min (${minVal}) must be <= max (${maxVal}).`);
  }
  return errors;
}
