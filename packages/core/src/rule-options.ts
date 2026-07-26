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
 */
export function validateRuleOptions(ruleId: string, spec: RuleOptionsSpec | undefined, options: RuleOptions): string[] {
  if (!spec) return [`${ruleId} takes no options.`];
  const errors: string[] = [];
  const isNonEmptyString = (v: unknown): boolean => typeof v === 'string' && v.length > 0;

  for (const [key, value] of Object.entries(options)) {
    const s = spec[key];
    if (!s) {
      errors.push(`${ruleId}: unknown option '${key}'. Known options: ${Object.keys(spec).join(', ')}.`);
      continue;
    }
    if (s.kind === 'integer') {
      if (typeof value !== 'number' || !Number.isInteger(value)) errors.push(`${ruleId}.${key} must be an integer.`);
      else if (s.min !== undefined && value < s.min) errors.push(`${ruleId}.${key} must be >= ${s.min}.`);
      else if (s.max !== undefined && value > s.max) errors.push(`${ruleId}.${key} must be <= ${s.max}.`);
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
  return errors;
}
