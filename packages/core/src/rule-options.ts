/**
 * Per-rule options: their declaration, resolution, and validation (design
 * 2026-07-26). Deliberately does not import `rule.ts` — `rule.ts` imports
 * `RuleOptionsSpec` from here, so taking `Rule` as a parameter would cycle.
 * Callers pass the id and the spec instead.
 */
import type { Config, RuleOptions } from './types.js';
import { compileOverrides, overrideMatches, settingOptions, type CompiledOverride } from './config-apply.js';

/**
 * Severity strings a rule setting accepts, plus `'off'` — the bare string form.
 * Module-private: `validateRuleSetting` is the only thing that needs it, and every
 * caller goes through that rather than re-deriving the list.
 */
const RULE_SETTING_VALUES: readonly string[] = ['off', 'critical', 'warning', 'info'];

/**
 * One configurable option. `kind` decides the merge semantics, so no rule
 * writes merge code of its own: `integer` replaces, and the two collection
 * kinds ADD to the built-in default (never replace — see the design doc).
 */
export type RuleOptionSpec =
  | { kind: 'integer'; default: number; min?: number; max?: number }
  | {
      kind: 'string-list';
      default: readonly string[];
      /**
       * Grammar every entry must match, checked at config load. A declaration-driven rule reserves
       * its grammar with this so a value the rule does not interpret today (`'input[type=file]'`
       * for a tag-name list) is rejected rather than accepted-and-ignored — accepting it would make
       * giving it meaning later a reinterpretation of a value the frozen schema already took.
       */
      pattern?: { regex: RegExp; describe: string };
    }
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
 * Typed reads of a resolved options object. `RuleOptions` values are `unknown`
 * (the map is open-ended by design), so without these every rule would carry
 * its own `o.max as number` cast and the "resolution guarantees the declared
 * kind" invariant would live in a dozen places instead of one. `resolveRuleOptions`
 * always seeds every declared key from the spec default and validation rejects a
 * wrongly-typed value up front, so a mismatch here means a rule read a key it
 * never declared — the `fallback` keeps that a wrong number rather than a crash.
 */
export function intOption(options: RuleOptions, key: string, fallback = 0): number {
  const v = options[key];
  return typeof v === 'number' ? v : fallback;
}

/** As `intOption`, for a `string-list` option. */
export function listOption(options: RuleOptions, key: string): string[] {
  const v = options[key];
  return Array.isArray(v) ? (v as string[]) : [];
}

/** As `intOption`, for a `string-map` option. */
export function mapOption(options: RuleOptions, key: string): Record<string, string> {
  const v = options[key];
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, string>) : {};
}

/**
 * Whether any config layer so much as mentions `ruleId` — its `rules` entry, or any `overrides`
 * entry's.
 *
 * A rule that is inert until declared can return early on `false` instead of resolving options once
 * per target and discarding the result. That waste is not hypothetical: the three directory-shaped
 * Architecture rules resolve per directory, so an unconfigured project pays it for every directory
 * under `src/` three times over, on every dev-server save. Measured 2026-07-30 over a synthetic tree
 * of 1,523 directories: 5.4 ms per analysis, for rules that are off by default and therefore produce
 * nothing.
 *
 * Deliberately conservative. It asks only whether the rule is *mentioned*, not whether the mention
 * resolves to a non-empty value, so a `'off'` severity with no options still answers `true` and the
 * caller does its normal work. A cheaper-but-wrong version of this would make a rule skip work it
 * owed; this one can only ever fail to save time.
 */
export function isMentionedAnywhere(config: Config, ruleId: string): boolean {
  // `Object.hasOwn`, not a `!== undefined` presence test: the latter walks the prototype chain, so a
  // `ruleId` of `toString` or `constructor` would find an inherited member on these plain objects and
  // report the rule as mentioned. Not reachable through a registered rule — every id contains a `/`,
  // which no `Object.prototype` member does — but it is how this repository does presence checks on
  // an open-ended record (`parseCasings` in rules/architecture/casing.ts, `perf/heavy-import`), and a
  // helper taking an id as a parameter should not depend on every caller passing a literal.
  if (Object.hasOwn(config.rules, ruleId)) return true;
  return (config.overrides ?? []).some((entry) => entry.rules !== undefined && Object.hasOwn(entry.rules, ruleId));
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
 * alone, as when validating the global layer itself. A `baseline` that is
 * only partially resolved (missing `min` or `max`) is treated as "can't
 * determine that side" rather than silently comparing against `undefined` —
 * see the `typeof` guard below.
 *
 * `skipRangeCheck`, when true, skips the min/max cross-check entirely
 * regardless of `baseline`. A caller sets this when it statically cannot
 * rule out that some *other* config layer narrows the opposite side of the
 * range at the same target — see the CLI's and the Vite plugin's
 * `overrides[]` validation (design 2026-07-26 review, Finding A, third
 * pass).
 */
export function validateRuleOptions(
  ruleId: string,
  spec: RuleOptionsSpec | undefined,
  options: RuleOptions,
  baseline?: RuleOptions,
  skipRangeCheck?: boolean
): string[] {
  // An empty `options` on a rule that declares none configures nothing, so it can't
  // be the typo this check exists to catch — accept it rather than failing a config
  // whose only sin is an empty object.
  if (!spec) return Object.keys(options).length === 0 ? [] : [`${ruleId} takes no options.`];
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
      } else if (s.pattern) {
        for (const v of value as string[]) {
          if (!s.pattern.regex.test(v)) errors.push(`${ruleId}.${key}: '${v}' is not ${s.pattern.describe}.`);
        }
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
  if (
    minSpec?.kind === 'integer' &&
    maxSpec?.kind === 'integer' &&
    !badKeys.has('min') &&
    !badKeys.has('max') &&
    !skipRangeCheck
  ) {
    const base = baseline ?? defaultsOf(spec);
    const minVal = 'min' in options ? (options.min as number) : base.min;
    const maxVal = 'max' in options ? (options.max as number) : base.max;
    // A partial `baseline` (e.g. `{ min: 40 }`, no `max`) leaves the other side
    // `undefined`. Comparing `minVal > maxVal` in that case is always `false` in
    // JS regardless of the actual values, which would silently no-op the check
    // rather than flag that this side is unresolved — guard explicitly instead
    // of relying on that comparison quirk (design 2026-07-26 review, Finding 3,
    // third pass). Every in-repo caller passes a fully resolved baseline; this
    // only matters for `validateRuleOptions` as a public `@svelte-vitals/core`
    // entry point.
    if (typeof minVal === 'number' && typeof maxVal === 'number' && minVal > maxVal) {
      errors.push(`${ruleId}: min (${minVal}) must be <= max (${maxVal}).`);
    }
  }
  return errors;
}

/** Whether `value` is a plain object (not null, not an array) — usable with Object.keys/entries. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whether some *other* entry in `overrides` narrows the opposite side of a
 * min/max range for the same rule key. Two override entries can both apply
 * to the same target at once (a `files:` scope and a `route:` scope are not
 * mutually exclusive, and even two `files:` scopes can overlap), so an entry
 * that narrows only `min` might combine with another entry's `max` at a
 * shared target and be valid there — but which entries actually co-apply
 * depends on the target's route/file, which is unknowable at config-load
 * time. This is therefore a conservative "might they?" check: `true` means
 * the single-layer baseline this entry would otherwise be validated against
 * can't be trusted, so the caller skips the range cross-check for this entry
 * rather than risk rejecting a config that is valid at every target (design
 * 2026-07-26 review, Finding A, third pass).
 *
 * Two false negatives follow from that conservatism and stay undetected:
 * two entries that each look valid alone but jointly invert the range where
 * both apply, and an entry that IS inverted against defaults + the global
 * `rules` layer but is skipped because some unrelated sibling entry happens
 * to set the opposite side. Both are statically undecidable for the same
 * reason, and both cost at most an odd-looking runtime message — never a
 * valid config rejected, which is the failure mode worth avoiding here.
 * See the design doc's "Out of scope" section.
 *
 * `overrides` is deliberately `readonly unknown[]`: the CLI's config-file
 * loader calls this before its own shape validation has run (so entries may
 * not yet be known to be objects), while the Vite plugin calls it on
 * already-typed `RuleOverride[]`. Both shapes satisfy `unknown[]` without
 * a cast, and the defensive `isPlainObject` checks below make the two
 * call sites' behaviour identical for well-formed input (design 2026-07-26
 * review, Finding 2 — this function previously existed verbatim, with this
 * same rationale comment, in both `packages/cli/src/config-file.ts` and
 * `packages/vite/src/plugin.ts`).
 */
function otherOverrideNarrowsOppositeSide(
  overrides: readonly unknown[],
  selfIndex: number,
  key: string,
  side: 'min' | 'max'
): boolean {
  return overrides.some((entry, i) => {
    if (i === selfIndex || !isPlainObject(entry) || !isPlainObject(entry.rules)) return false;
    const setting = entry.rules[key];
    return isPlainObject(setting) && isPlainObject(setting.options) && side in setting.options;
  });
}

/**
 * Whether `validateRuleOptions` should skip the min/max cross-check for
 * `overrides[selfIndex].rules[key]` — the whole decision, so the CLI's
 * config-file loader and the Vite plugin can't drift apart on it (they held
 * line-for-line copies of it before).
 *
 * An entry that sets both sides, or neither, is judged against its baseline as
 * usual. An entry that sets only one side is skipped when some *other* entry
 * sets the opposite side, since the two may co-apply at a shared target and be
 * valid there — see `otherOverrideNarrowsOppositeSide` for why that is
 * conservative by necessity and what it lets through.
 */
export function shouldSkipRangeCheck(
  overrides: readonly unknown[],
  selfIndex: number,
  key: string,
  setting: unknown
): boolean {
  if (!isPlainObject(setting) || !isPlainObject(setting.options)) return false;
  const setsMin = 'min' in setting.options;
  const setsMax = 'max' in setting.options;
  if (setsMin === setsMax) return false; // both sides or neither → the baseline decides
  return otherOverrideNarrowsOppositeSide(overrides, selfIndex, key, setsMin ? 'max' : 'min');
}

/**
 * Problems with one user-supplied rule setting — the bare severity string or the
 * object form — as human-readable sentences prefixed with `label` (empty = valid).
 * THE single definition of what a setting may look like: the CLI's config-file
 * loader and the Vite plugin both funnel through it, so a config file and the
 * equivalent plugin option are accepted or rejected identically. Callers treat any
 * result as fatal, on the same reasoning as an unknown rule id — a typo that
 * silently leaves the config inert is the failure being prevented.
 *
 * `label` names the setting in the message (e.g. `rules.seo/title-length`,
 * `overrides[0].rules.architecture`); `ruleId` is the key options messages quote.
 * `allowOptions` is false for a category key: a category may carry a severity, but
 * options are rule-specific and meaningless there. `baseline` and `skipRangeCheck`
 * are passed through to `validateRuleOptions`.
 */
export function validateRuleSetting(
  label: string,
  ruleId: string,
  setting: unknown,
  spec: RuleOptionsSpec | undefined,
  opts: { allowOptions: boolean; baseline?: RuleOptions; skipRangeCheck?: boolean }
): string[] {
  const expected = RULE_SETTING_VALUES.join('|');
  if (typeof setting === 'string') {
    return RULE_SETTING_VALUES.includes(setting)
      ? []
      : [`${label}: invalid setting '${setting}'; expected ${expected}.`];
  }
  if (!isPlainObject(setting)) {
    return [`${label}: must be ${expected} or an object with 'severity' and/or 'options'.`];
  }
  const errors: string[] = [];
  const unknownKeys = Object.keys(setting).filter((k) => k !== 'severity' && k !== 'options');
  if (unknownKeys.length > 0) {
    errors.push(`${label}: unknown key(s) ${unknownKeys.join(', ')}; expected severity, options.`);
  }
  if (setting.severity !== undefined && !RULE_SETTING_VALUES.includes(setting.severity as string)) {
    errors.push(`${label}.severity: invalid setting '${String(setting.severity)}'; expected ${expected}.`);
  }
  if (setting.options === undefined) return errors;
  if (!opts.allowOptions) {
    errors.push(`${label}: options are not allowed on a category key.`);
    return errors;
  }
  if (!isPlainObject(setting.options)) {
    errors.push(`${label}.options: must be an object.`);
    return errors;
  }
  const optionErrors = validateRuleOptions(ruleId, spec, setting.options, opts.baseline, opts.skipRangeCheck);
  if (optionErrors.length > 0) errors.push(`${label}: ${optionErrors.join(' ')}`);
  return errors;
}
