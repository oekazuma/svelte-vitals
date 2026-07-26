# Per-rule Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `RuleSetting` so rule thresholds and built-in lists can be configured globally and per-path, unblocking Architecture category expansion.

**Architecture:** `RuleSetting` gains an object member `{ severity?, options? }`. Each rule declares an options _spec_ (`Rule.options`) whose `kind` determines merge semantics — `integer` replaces, `string-list`/`string-map` add to the built-in default. Severity keeps resolving after rules run; options resolve _during_ the run from `ctx.config`, because a threshold is an input to the verdict. Both paths share one glob-matching implementation.

**Tech Stack:** TypeScript, vitest, pnpm workspaces. `packages/core` (rule engine) and `packages/cli` (config loading/validation).

**Spec:** `docs/superpowers/specs/2026-07-26-rule-options-design.md`

## Global Constraints

- **Core purity:** no `node:` imports, no I/O, no runtime-specific globals anywhere in `packages/core/src`. All validation is hand-written — do not add a schema library.
- **Addition-only list semantics:** `string-list` and `string-map` options always merge into the built-in default. There is no replace mode and no per-entry exclusion.
- **Options never attach to category keys.** In `overrides[].rules`, a key like `architecture` may carry a severity but never `options`.
- **Glob matching lives in exactly one place.** `applyOverrides` (post-pass) and `resolveRuleOptions` (in-run) must call the same matcher. A second copy is a defect.
- **Default thresholds stay pinned by tests.** The existing boundary values (`propCount` 6, `loc` 200, title 30/60, description 70/160) must still fail a test if edited by accident.
- Conventional commits, scoped by package (`feat(core):`, `feat(cli):`, `docs:`).

## File Structure

| File                                                                           | Responsibility                                                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/types.ts` (modify)                                          | `RuleSettingObject`, widened `RuleSetting`, `RuleOptions`                                                                                                                                            |
| `packages/core/src/config-apply.ts` (modify)                                   | `settingSeverity`/`settingOptions` accessors; extracted `compileOverrides`/`overrideMatches`; existing post-pass functions migrated onto them                                                        |
| `packages/core/src/rule-options.ts` (create)                                   | `RuleOptionSpec`, `RuleOptionsSpec`, `resolveRuleOptions`, `validateRuleOptions`. Deliberately does **not** import `rule.ts` — that would cycle, since `rule.ts` imports `RuleOptionsSpec` from here |
| `packages/core/src/rule.ts` (modify)                                           | `Rule.options?: RuleOptionsSpec`                                                                                                                                                                     |
| `packages/core/src/rules/component-rule.ts` (modify)                           | resolve options per component; pass to `applies`/`bad`; support callable `recommendation`                                                                                                            |
| `packages/core/src/rules/seo/length-rule.ts` (modify)                          | same, per route                                                                                                                                                                                      |
| `packages/core/src/rules/architecture/{prop-count,component-size}.ts` (modify) | declare `max`                                                                                                                                                                                        |
| `packages/core/src/rules/seo/{title-length,description-length}.ts` (modify)    | inherit `min`/`max` options from the factory                                                                                                                                                         |
| `packages/core/src/rules/perf/heavy-import.ts` (modify)                        | declare `packages` (`string-map`)                                                                                                                                                                    |
| `packages/core/src/rules/perf/preconnect.ts` (modify)                          | declare `origins` (`string-list`), resolve inline                                                                                                                                                    |
| `packages/core/src/index.ts` (modify)                                          | export the new public surface                                                                                                                                                                        |
| `packages/cli/src/rules-config.ts` (modify)                                    | `ruleOptionsSpec(id)` lookup                                                                                                                                                                         |
| `packages/cli/src/config-file.ts` (modify)                                     | validate the object form in `rules` and `overrides[].rules`                                                                                                                                          |

---

### Task 1: Widen `RuleSetting` and route every read through accessors

The riskiest part of the whole change: `selectRules` compares `config.rules[id] !== 'off'` directly. The moment a user writes the object form, that comparison stops disabling rules — silently. Accessors first, everything else after.

**Files:**

- Modify: `packages/core/src/types.ts:94` (the `RuleSetting` definition)
- Modify: `packages/core/src/config-apply.ts:1-15` (`selectRules`, `applyRuleSeverities`), `:50-76` (`applyOverrides`)
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/config-apply.test.ts`

**Interfaces:**

- Produces: `RuleSettingObject`, `RuleOptions`, widened `RuleSetting` (all from `types.ts`); `settingSeverity(setting): Severity | 'off' | undefined` and `settingOptions(setting): RuleOptions | undefined` (from `config-apply.ts`).

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/config-apply.test.ts`, inside the existing `describe('config application', …)` block:

```ts
it('drops rules disabled through the object form', () => {
  const kept = selectRules([ruleA, ruleB], defineConfig({ rules: { 'seo/json-ld': { severity: 'off' } } }));
  expect(kept.map((r) => r.id)).toEqual(['seo/title-presence']);
});
it('keeps rules whose object form only carries options', () => {
  const kept = selectRules([ruleA, ruleB], defineConfig({ rules: { 'seo/json-ld': { options: { max: 3 } } } }));
  expect(kept.map((r) => r.id)).toEqual(['seo/title-presence', 'seo/json-ld']);
});
it('overrides severity through the object form', () => {
  const results: Result[] = [
    { id: 'seo/canonical-url', severity: 'warning', detection: { presence: 'none', value: 'absent' }, message: 'x' }
  ];
  const out = applyRuleSeverities(results, defineConfig({ rules: { 'seo/canonical-url': { severity: 'critical' } } }));
  expect(out[0]!.severity).toBe('critical');
});
it('leaves severity alone when the object form carries only options', () => {
  const results: Result[] = [
    { id: 'seo/canonical-url', severity: 'warning', detection: { presence: 'none', value: 'absent' }, message: 'x' }
  ];
  const out = applyRuleSeverities(results, defineConfig({ rules: { 'seo/canonical-url': { options: { max: 1 } } } }));
  expect(out[0]!.severity).toBe('warning');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/config-apply.test.ts`
Expected: FAIL — the object form is not assignable to `RuleSetting`, so these are type errors and the `off` assertions fail at runtime.

- [ ] **Step 3: Widen the type**

In `packages/core/src/types.ts`, replace the `RuleSetting` line:

```ts
/** Resolved option values handed to a rule at check time. */
export type RuleOptions = Record<string, unknown>;

/**
 * Object form of a rule setting. `severity` omitted keeps the rule's built-in
 * severity — the common case when only a threshold is being moved.
 * `{ severity: 'off', … }` disables the rule and any `options` beside it are
 * inert (equivalent to the bare `'off'` string, not an error).
 */
export interface RuleSettingObject {
  severity?: Severity | 'off';
  options?: RuleOptions;
}

/** Per-rule override: disable, change severity, and/or set options. */
export type RuleSetting = 'off' | Severity | RuleSettingObject;
```

- [ ] **Step 4: Add the accessors and migrate every read**

Replace the top of `packages/core/src/config-apply.ts` (through `applyRuleSeverities`):

```ts
import type { Config, Result, RuleOptions, RuleSetting, Severity } from './types.js';
import type { Rule } from './rule.js';

/** The severity a setting selects: `'off'`, an explicit severity, or undefined (leave the built-in). */
export function settingSeverity(setting: RuleSetting | undefined): Severity | 'off' | undefined {
  if (setting === undefined) return undefined;
  if (typeof setting === 'string') return setting;
  return setting.severity;
}

/** The options a setting carries, or undefined for the string forms. */
export function settingOptions(setting: RuleSetting | undefined): RuleOptions | undefined {
  return setting !== undefined && typeof setting !== 'string' ? setting.options : undefined;
}

/** Drop rules disabled via config (design §6). */
export function selectRules(rules: Rule[], config: Config): Rule[] {
  return rules.filter((rule) => settingSeverity(config.rules[rule.id]) !== 'off');
}

/** Apply per-rule severity overrides to results (design §6). */
export function applyRuleSeverities(results: Result[], config: Config): Result[] {
  return results.map((result) => {
    const severity = settingSeverity(config.rules[result.id]);
    return severity !== undefined && severity !== 'off' ? { ...result, severity } : result;
  });
}
```

Then in `applyOverrides`, replace the accumulation loop body so it tracks a severity rather than a raw setting:

```ts
const out: Result[] = [];
for (const result of results) {
  const { route, location } = result;
  let severity: Severity | 'off' | undefined;
  for (const o of compiled) {
    const matched =
      (route !== undefined && o.routes.some((p) => p.test(route))) ||
      (location !== undefined && o.files.some((p) => p.test(location)));
    if (!matched) continue;
    const s = o.rules[result.id] ?? o.rules[result.category ?? 'seo'];
    // An options-only entry carries no severity — it must not clear one set earlier.
    if (s !== undefined) severity = settingSeverity(s) ?? severity;
  }
  if (severity === undefined) out.push(result);
  else if (severity !== 'off') out.push({ ...result, severity });
}
return out;
```

- [ ] **Step 5: Export the new surface**

In `packages/core/src/index.ts`, add `RuleOptions` and `RuleSettingObject` to the type export block that already lists `RuleSetting` (line ~15), and extend the `config-apply.js` re-export (line 153):

```ts
export { selectRules, applyRuleSeverities, applyOverrides, settingSeverity, settingOptions } from './config-apply.js';
```

- [ ] **Step 6: Run the full core suite**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS, including the pre-existing `config-apply` and `route-overrides` tests — the string forms must be untouched.

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/config-apply.ts packages/core/src/index.ts packages/core/test/config-apply.test.ts
git commit -m "feat(core): accept an object form of RuleSetting"
```

---

### Task 2: Extract the shared glob matcher

**Files:**

- Modify: `packages/core/src/config-apply.ts` (`applyOverrides`)
- Test: `packages/core/test/config-apply.test.ts`

**Interfaces:**

- Consumes: `settingSeverity` (Task 1).
- Produces: `CompiledOverride` (`{ routes: RegExp[]; files: RegExp[]; rules: Record<string, RuleSetting> }`), `compileOverrides(config): CompiledOverride[]`, `overrideMatches(o, target: { route?: string; file?: string }): boolean`.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/test/config-apply.test.ts`. The file already imports `defineConfig` from
`../src/index.js` — add `compileOverrides` and `overrideMatches` to that existing import rather than
writing a second import statement:

```ts
describe('override matching', () => {
  const config = defineConfig({
    overrides: [{ files: 'src/lib/**', rules: { 'architecture/prop-count': 'off' } }]
  });
  it('matches a file under the glob', () => {
    const [o] = compileOverrides(config);
    expect(overrideMatches(o!, { file: 'src/lib/Button.svelte' })).toBe(true);
  });
  it('does not match a file outside the glob', () => {
    const [o] = compileOverrides(config);
    expect(overrideMatches(o!, { file: 'src/routes/+page.svelte' })).toBe(false);
  });
  it('matches on route when only a route target is given', () => {
    const [o] = compileOverrides(defineConfig({ overrides: [{ route: '/admin/**', rules: { seo: 'off' } }] }));
    expect(overrideMatches(o!, { route: '/admin/users' })).toBe(true);
    expect(overrideMatches(o!, { route: '/about' })).toBe(false);
  });
  it('returns an empty list when the config has no overrides', () => {
    expect(compileOverrides(defineConfig({}))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/config-apply.test.ts`
Expected: FAIL — `compileOverrides` / `overrideMatches` are not exported.

- [ ] **Step 3: Extract, and rewrite `applyOverrides` on top of it**

In `packages/core/src/config-apply.ts`, after `toPatterns`, add:

```ts
/** An override entry with its globs compiled once. Build with `compileOverrides`. */
export interface CompiledOverride {
  routes: RegExp[];
  files: RegExp[];
  rules: Record<string, RuleSetting>;
}

/**
 * Compile every override entry's globs to RegExp, once. Callers that match many
 * targets (every component, every route) must hoist this out of their loop.
 */
export function compileOverrides(config: Config): CompiledOverride[] {
  return (config.overrides ?? []).map((o) => ({
    routes: toPatterns(o.route),
    files: toPatterns(o.files),
    rules: o.rules
  }));
}

/**
 * Whether an override entry applies to a target. THE single definition of that
 * question — the result post-pass and in-run option resolution both call it, so
 * a severity override and an option override can never select different files.
 */
export function overrideMatches(o: CompiledOverride, target: { route?: string; file?: string }): boolean {
  const { route, file } = target;
  return (
    (route !== undefined && o.routes.some((p) => p.test(route))) ||
    (file !== undefined && o.files.some((p) => p.test(file)))
  );
}
```

Then replace `applyOverrides`'s body so it uses them:

```ts
export function applyOverrides(results: Result[], config: Config): Result[] {
  const compiled = compileOverrides(config);
  if (compiled.length === 0) return results;

  const out: Result[] = [];
  for (const result of results) {
    let severity: Severity | 'off' | undefined;
    for (const o of compiled) {
      if (!overrideMatches(o, { route: result.route, file: result.location })) continue;
      const s = o.rules[result.id] ?? o.rules[result.category ?? 'seo'];
      if (s !== undefined) severity = settingSeverity(s) ?? severity;
    }
    if (severity === undefined) out.push(result);
    else if (severity !== 'off') out.push({ ...result, severity });
  }
  return out;
}
```

- [ ] **Step 4: Export**

In `packages/core/src/index.ts`, extend the `config-apply.js` re-export with `compileOverrides` and `overrideMatches`, and add `type CompiledOverride` to the type exports.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS. `route-overrides.test.ts` is the regression guard — `applyOverrides` behaviour must be identical.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/config-apply.ts packages/core/src/index.ts packages/core/test/config-apply.test.ts
git commit -m "refactor(core): extract override glob matching into a shared helper"
```

---

### Task 3: `resolveRuleOptions` and `validateRuleOptions`

**Files:**

- Create: `packages/core/src/rule-options.ts`
- Create: `packages/core/test/rule-options.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: `compileOverrides`, `overrideMatches`, `settingOptions` (Tasks 1–2).
- Produces:
  - `RuleOptionSpec` = `{ kind: 'integer'; default: number; min?: number; max?: number }` | `{ kind: 'string-list'; default: readonly string[] }` | `{ kind: 'string-map'; default: Readonly<Record<string, string>> }`
  - `RuleOptionsSpec = Record<string, RuleOptionSpec>`
  - `resolveRuleOptions(ruleId, spec, config, target?, compiled?): RuleOptions`
  - `validateRuleOptions(ruleId, spec, options): string[]`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/test/rule-options.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveRuleOptions, validateRuleOptions, compileOverrides, defineConfig } from '../src/index.js';
import type { RuleOptionsSpec } from '../src/index.js';

const spec: RuleOptionsSpec = {
  max: { kind: 'integer', default: 6, min: 1 },
  packages: { kind: 'string-map', default: { lodash: 'use lodash-es' } },
  origins: { kind: 'string-list', default: ['fonts.googleapis.com'] }
};

describe('resolveRuleOptions', () => {
  it('returns the built-in defaults with an empty config', () => {
    expect(resolveRuleOptions('r', spec, defineConfig({}))).toEqual({
      max: 6,
      packages: { lodash: 'use lodash-es' },
      origins: ['fonts.googleapis.com']
    });
  });
  it('returns an empty object for a rule with no spec', () => {
    expect(resolveRuleOptions('r', undefined, defineConfig({}))).toEqual({});
  });
  it('replaces an integer from the global setting', () => {
    const config = defineConfig({ rules: { r: { options: { max: 10 } } } });
    expect(resolveRuleOptions('r', spec, config).max).toBe(10);
  });
  it('adds to a list rather than replacing it', () => {
    const config = defineConfig({ rules: { r: { options: { origins: ['cdn.example.com'] } } } });
    expect(resolveRuleOptions('r', spec, config).origins).toEqual(['fonts.googleapis.com', 'cdn.example.com']);
  });
  it('adds to a map rather than replacing it', () => {
    const config = defineConfig({ rules: { r: { options: { packages: { moment: 'use dayjs' } } } } });
    expect(resolveRuleOptions('r', spec, config).packages).toEqual({
      lodash: 'use lodash-es',
      moment: 'use dayjs'
    });
  });
  it('lets a matching override replace the global integer', () => {
    const config = defineConfig({
      rules: { r: { options: { max: 10 } } },
      overrides: [{ files: 'src/lib/**', rules: { r: { options: { max: 4 } } } }]
    });
    expect(resolveRuleOptions('r', spec, config, { file: 'src/lib/B.svelte' }).max).toBe(4);
    expect(resolveRuleOptions('r', spec, config, { file: 'src/routes/+page.svelte' }).max).toBe(10);
  });
  it('takes the last matching override for an integer', () => {
    const config = defineConfig({
      overrides: [
        { files: 'src/**', rules: { r: { options: { max: 4 } } } },
        { files: 'src/lib/**', rules: { r: { options: { max: 8 } } } }
      ]
    });
    expect(resolveRuleOptions('r', spec, config, { file: 'src/lib/B.svelte' }).max).toBe(8);
  });
  it('accumulates lists across defaults, global and overrides', () => {
    const config = defineConfig({
      rules: { r: { options: { origins: ['a.example.com'] } } },
      overrides: [{ files: 'src/**', rules: { r: { options: { origins: ['b.example.com'] } } } }]
    });
    expect(resolveRuleOptions('r', spec, config, { file: 'src/x.svelte' }).origins).toEqual([
      'fonts.googleapis.com',
      'a.example.com',
      'b.example.com'
    ]);
  });
  it('ignores options under a category key', () => {
    const config = defineConfig({
      overrides: [{ files: 'src/**', rules: { seo: { options: { max: 99 } } } }]
    });
    expect(resolveRuleOptions('r', spec, config, { file: 'src/x.svelte' }).max).toBe(6);
  });
  it('gives the same answer with a hoisted compiled list', () => {
    const config = defineConfig({ overrides: [{ files: 'src/lib/**', rules: { r: { options: { max: 4 } } } }] });
    const compiled = compileOverrides(config);
    expect(resolveRuleOptions('r', spec, config, { file: 'src/lib/B.svelte' }, compiled).max).toBe(4);
  });
  it('does not mutate the spec defaults across calls', () => {
    const config = defineConfig({ rules: { r: { options: { origins: ['x.example.com'] } } } });
    resolveRuleOptions('r', spec, config);
    expect(resolveRuleOptions('r', spec, defineConfig({})).origins).toEqual(['fonts.googleapis.com']);
  });
});

describe('validateRuleOptions', () => {
  it('accepts valid options', () => {
    expect(validateRuleOptions('r', spec, { max: 10, origins: ['a.com'], packages: { m: 'x' } })).toEqual([]);
  });
  it('rejects an unknown option key', () => {
    expect(validateRuleOptions('r', spec, { maxx: 10 })[0]).toContain("unknown option 'maxx'");
  });
  it('rejects options on a rule that declares none', () => {
    expect(validateRuleOptions('r', undefined, { max: 1 })[0]).toContain('takes no options');
  });
  it('rejects a non-integer for an integer option', () => {
    expect(validateRuleOptions('r', spec, { max: '10' })[0]).toContain('must be an integer');
    expect(validateRuleOptions('r', spec, { max: 1.5 })[0]).toContain('must be an integer');
  });
  it('rejects an integer below the spec minimum', () => {
    expect(validateRuleOptions('r', spec, { max: 0 })[0]).toContain('must be >= 1');
  });
  it('rejects a non-list for a list option', () => {
    expect(validateRuleOptions('r', spec, { origins: 'a.com' })[0]).toContain('array of non-empty strings');
    expect(validateRuleOptions('r', spec, { origins: [''] })[0]).toContain('array of non-empty strings');
  });
  it('rejects a non-map for a map option', () => {
    expect(validateRuleOptions('r', spec, { packages: ['lodash'] })[0]).toContain('string → non-empty string');
    expect(validateRuleOptions('r', spec, { packages: { lodash: 1 } })[0]).toContain('string → non-empty string');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/rule-options.test.ts`
Expected: FAIL — module `rule-options` does not exist.

- [ ] **Step 3: Implement**

Create `packages/core/src/rule-options.ts`:

```ts
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
```

- [ ] **Step 4: Export**

In `packages/core/src/index.ts` add:

```ts
export { resolveRuleOptions, validateRuleOptions } from './rule-options.js';
export type { RuleOptionSpec, RuleOptionsSpec } from './rule-options.js';
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/rule-options.test.ts`
Expected: PASS, all 20 cases.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/rule-options.ts packages/core/src/index.ts packages/core/test/rule-options.test.ts
git commit -m "feat(core): add rule option specs, resolution and validation"
```

---

### Task 4: Wire options into `componentRule` and the two Architecture rules

Note the `recommendation` problem this task solves: `architecture/prop-count`'s recommendation string interpolates the threshold at module load. Once `max` is configurable, a static string would tell a user who set `max: 10` to split at 6. `recommendation` therefore becomes optionally callable.

**Files:**

- Modify: `packages/core/src/rule.ts` (the `Rule` interface)
- Modify: `packages/core/src/rules/component-rule.ts`
- Modify: `packages/core/src/rules/architecture/prop-count.ts`, `packages/core/src/rules/architecture/component-size.ts`
- Test: `packages/core/test/architecture-rules.test.ts`

**Interfaces:**

- Consumes: `resolveRuleOptions`, `RuleOptionsSpec` (Task 3); `compileOverrides` (Task 2).
- Produces: `Rule.options?: RuleOptionsSpec`; `ComponentRuleOptions.options?: RuleOptionsSpec`; `applies`/`bad` signatures widened to `(c: ComponentFacts, o: RuleOptions)`; `recommendation: string | ((o: RuleOptions) => string)`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/architecture-rules.test.ts`:

```ts
describe('architecture rule options', () => {
  const ctxWith = (cfg: Parameters<typeof defineConfig>[0], components: ComponentFacts[]): RuleContext => ({
    components,
    heads: [],
    project: defaultProject,
    config: defineConfig(cfg)
  });

  it('pins the built-in prop-count threshold', async () => {
    expect(fails(await architecturePropCount.check(ctx([comp({ propCount: 6 })])))).toHaveLength(0);
    expect(fails(await architecturePropCount.check(ctx([comp({ propCount: 7 })])))).toHaveLength(1);
  });
  it('pins the built-in component-size threshold', async () => {
    expect(fails(await architectureComponentSize.check(ctx([comp({ loc: 200 })])))).toHaveLength(0);
    expect(fails(await architectureComponentSize.check(ctx([comp({ loc: 201 })])))).toHaveLength(1);
  });
  it('honours a configured prop-count max', async () => {
    const cfg = { rules: { 'architecture/prop-count': { options: { max: 10 } } } };
    expect(fails(await architecturePropCount.check(ctxWith(cfg, [comp({ propCount: 8 })])))).toHaveLength(0);
    expect(fails(await architecturePropCount.check(ctxWith(cfg, [comp({ propCount: 11 })])))).toHaveLength(1);
  });
  it('honours a per-path prop-count max', async () => {
    const cfg = {
      rules: { 'architecture/prop-count': { options: { max: 10 } } },
      overrides: [{ files: 'src/lib/**', rules: { 'architecture/prop-count': { options: { max: 4 } } } }]
    };
    const lib = comp({ file: 'src/lib/Button.svelte', propCount: 6 });
    const route = comp({ file: 'src/routes/+page.svelte', propCount: 6 });
    expect(fails(await architecturePropCount.check(ctxWith(cfg, [lib])))).toHaveLength(1);
    expect(fails(await architecturePropCount.check(ctxWith(cfg, [route])))).toHaveLength(0);
  });
  it('reports the configured threshold in the message and recommendation', async () => {
    const cfg = { rules: { 'architecture/prop-count': { options: { max: 10 } } } };
    const rs = fails(await architecturePropCount.check(ctxWith(cfg, [comp({ propCount: 11 })])));
    expect(rs[0]!.message).toContain('over 10');
    expect(rs[0]!.recommendation).toContain('10');
  });
});
```

The test file's `fails()` helper currently returns `{ detection }`-shaped objects; widen its parameter type to `Result[]` if TypeScript complains about `.message` / `.recommendation`, and import `Result` from `../src/index.js`.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/architecture-rules.test.ts`
Expected: FAIL — configured cases still use 6, and `recommendation` is a static string.

- [ ] **Step 3: Add `options` to the `Rule` interface**

In `packages/core/src/rule.ts`, import the type and add the field to `interface Rule` after `fix`:

```ts
import type { RuleOptionsSpec } from './rule-options.js';
```

```ts
  /** Configurable options for this rule; absent means the rule takes none. */
  options?: RuleOptionsSpec;
```

- [ ] **Step 4: Thread options through `componentRule`**

In `packages/core/src/rules/component-rule.ts`, add the imports:

```ts
import type { RuleOptions } from '../types.js';
import { compileOverrides } from '../config-apply.js';
import { resolveRuleOptions, type RuleOptionsSpec } from '../rule-options.js';
```

Change the three affected fields of `ComponentRuleOptions`:

```ts
  /** Pass message / category label. */
  label: string;
  /** Static text, or a function of the resolved options when it quotes a threshold. */
  recommendation: string | ((o: RuleOptions) => string);
  rationale: string;
  /** Configurable options for this rule; absent means the rule takes none. */
  options?: RuleOptionsSpec;
  /** Agent-actionable remediation attached to the rule and each penalized finding. */
  fix?: Fix;
  /** Whether this component carries the signal at all (no signal → emit nothing for the file). */
  applies: (c: ComponentFacts, o: RuleOptions) => boolean;
  /** The offending occurrences in a component (empty → the file passes). */
  bad: (c: ComponentFacts, o: RuleOptions) => ComponentIssue[];
```

In the returned rule, add `options` to the object literal alongside `fix`:

```ts
    ...(opts.options ? { options: opts.options } : {}),
```

and rewrite the `check` body's loop:

```ts
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      // Hoisted: compiling every override's globs once, not once per component.
      const compiled = compileOverrides(ctx.config);
      for (const c of ctx.components ?? []) {
        const o = resolveRuleOptions(opts.id, opts.options, ctx.config, { route: c.file, file: c.file }, compiled);
        const recommendation = typeof opts.recommendation === 'function' ? opts.recommendation(o) : opts.recommendation;
        if (!opts.applies(c, o)) continue; // no signal in this file → neither penalize nor seed
        const bad = opts.bad(c, o).filter((b) => !(b.line > 0 && isSuppressed(c, opts.id, b.line)));
```

Then replace both `recommendation: opts.recommendation` occurrences in the emitted results with `recommendation`.

- [ ] **Step 5: Declare the options on both Architecture rules**

`packages/core/src/rules/architecture/prop-count.ts` — keep the existing doc comment on `MAX_PROPS` verbatim and replace the rule body:

```ts
export const architecturePropCount = componentRule({
  id: 'architecture/prop-count',
  title: 'Prop count',
  category: 'architecture',
  severity: 'info',
  label: 'Prop count',
  options: { max: { kind: 'integer', default: MAX_PROPS, min: 1 } },
  recommendation: (o) =>
    `Group related props into an object, or split the component, when it takes more than ${o.max as number} props.`,
  rationale:
    'A component taking many props is usually doing too much; grouping or splitting keeps its API understandable.',
  applies: (c) => c.propCount > 0, // only components whose props we could count
  bad: (c, o) => {
    const max = o.max as number;
    return c.propCount > max ? [{ line: 1, message: `Component takes ${c.propCount} props (over ${max})` }] : [];
  }
});
```

`packages/core/src/rules/architecture/component-size.ts` — likewise, keeping the `MAX_LOC` doc comment:

```ts
export const architectureComponentSize = componentRule({
  id: 'architecture/component-size',
  title: 'Component size',
  category: 'architecture',
  severity: 'info',
  label: 'Component size',
  options: { max: { kind: 'integer', default: MAX_LOC, min: 1 } },
  recommendation: (o) => `Split components over ${o.max as number} lines into smaller, focused pieces.`,
  rationale:
    'A very large component is hard to read, test, and reuse, and is a common sign that several responsibilities should be split out.',
  applies: (c) => c.loc > 0, // skip unanalyzable files (loc 0 = read/parse failure), don't PASS them
  bad: (c, o) => {
    const max = o.max as number;
    return c.loc > max ? [{ line: 1, message: `Component is ${c.loc} lines (over ${max})` }] : [];
  }
});
```

- [ ] **Step 6: Run the full core suite**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS. Every other `componentRule`-based rule keeps a one-argument `applies`/`bad`, which stays assignable to the two-argument type — no other rule file needs editing.

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm typecheck`

```bash
git add packages/core/src/rule.ts packages/core/src/rules/component-rule.ts packages/core/src/rules/architecture packages/core/test/architecture-rules.test.ts
git commit -m "feat(core): make the architecture thresholds configurable"
```

---

### Task 5: Wire options into `lengthRule`

**Files:**

- Modify: `packages/core/src/rules/seo/length-rule.ts`, `packages/core/src/rules/seo/title-length.ts`, `packages/core/src/rules/seo/description-length.ts`
- Test: `packages/core/test/seo-length-rules.test.ts`

**Interfaces:**

- Consumes: `resolveRuleOptions`, `compileOverrides`.
- Produces: `seo/title-length` and `seo/description-length` both carrying `{ min, max }` integer options.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/seo-length-rules.test.ts` already defines `headWith`, `title(text)`, `desc(text)`,
`fails`, and a `ctx(head)` whose config is hard-coded to `defineConfig({})`. Append this block, which
adds a config-taking variant beside `ctx` and reuses everything else:

```ts
describe('seo length rule options', () => {
  const cfgCtx = (head: ResolvedHead, cfg: Parameters<typeof defineConfig>[0]): RuleContext => ({
    heads: [head],
    project: defaultProject,
    config: defineConfig(cfg)
  });
  const opts = { rules: { 'seo/title-length': { options: { min: 10, max: 20 } } } };

  it('pins the built-in title bounds', async () => {
    expect(fails(await seoTitleLength.check(ctx(title('a'.repeat(29)))))).toHaveLength(1);
    expect(fails(await seoTitleLength.check(ctx(title('a'.repeat(30)))))).toHaveLength(0);
    expect(fails(await seoTitleLength.check(ctx(title('a'.repeat(60)))))).toHaveLength(0);
    expect(fails(await seoTitleLength.check(ctx(title('a'.repeat(61)))))).toHaveLength(1);
  });
  it('pins the built-in description bounds', async () => {
    expect(fails(await seoDescriptionLength.check(ctx(desc('a'.repeat(69)))))).toHaveLength(1);
    expect(fails(await seoDescriptionLength.check(ctx(desc('a'.repeat(70)))))).toHaveLength(0);
    expect(fails(await seoDescriptionLength.check(ctx(desc('a'.repeat(160)))))).toHaveLength(0);
    expect(fails(await seoDescriptionLength.check(ctx(desc('a'.repeat(161)))))).toHaveLength(1);
  });
  it('honours configured title bounds', async () => {
    expect(fails(await seoTitleLength.check(cfgCtx(title('a'.repeat(15)), opts)))).toHaveLength(0);
    expect(fails(await seoTitleLength.check(cfgCtx(title('a'.repeat(25)), opts)))).toHaveLength(1);
  });
  it('quotes the configured bounds in the message and recommendation', async () => {
    const rs = fails(await seoTitleLength.check(cfgCtx(title('a'.repeat(25)), opts)));
    expect(rs[0]!.message).toContain('10–20');
    expect(rs[0]!.recommendation).toContain('10–20');
  });
  it('honours a per-route bound', async () => {
    const scoped = { overrides: [{ route: '/x', rules: { 'seo/title-length': { options: { min: 1, max: 5 } } } }] };
    expect(fails(await seoTitleLength.check(cfgCtx(title('a'.repeat(40)), scoped)))).toHaveLength(1);
    expect(fails(await seoTitleLength.check(cfgCtx(title('abc'), scoped)))).toHaveLength(0);
  });
});
```

The file's `headWith` sets `route: '/x'`, which is what the per-route override case matches on.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/seo-length-rules.test.ts`
Expected: FAIL on the configured cases — bounds are still 30/60.

- [ ] **Step 3: Implement**

In `packages/core/src/rules/seo/length-rule.ts`, add the imports:

```ts
import { compileOverrides } from '../../config-apply.js';
import { resolveRuleOptions, type RuleOptionsSpec } from '../../rule-options.js';
```

Inside `lengthRule`, above the returned object (next to the existing `const docsUrl = docsUrlFor(opts.id);`),
build the spec once so the rule declaration and the per-route resolution share one literal:

```ts
const spec: RuleOptionsSpec = {
  min: { kind: 'integer', default: opts.min, min: 0 },
  max: { kind: 'integer', default: opts.max, min: 1 }
};
```

Add `options: spec,` to the returned rule object (after `rationale`), then rewrite the head of the
`check` loop so the bounds come from the resolved options rather than `opts`:

```ts
      const compiled = compileOverrides(ctx.config);
      for (const head of ctx.heads) {
        const tag = head.tags.find(opts.match);
        // No tag, or dynamic/absent text → presence is seo/title-presence's or
        // seo/description-presence's concern, emit nothing.
        if (!tag || typeof tag.text !== 'string') continue;
        const o = resolveRuleOptions(opts.id, spec, ctx.config, { route: head.route }, compiled);
        const min = o.min as number;
        const max = o.max as number;
        const len = visibleLength(tag.text);
        let problem: string | undefined;
        if (len < min) problem = `${opts.noun} is too short (${len} chars; aim for ${min}–${max})`;
        else if (len > max) problem = `${opts.noun} is too long (${len} chars; aim for ${min}–${max})`;
```

Make `recommendation` callable exactly as `componentRule` does, so a configured project is not told
to aim for the built-in bounds. In `LengthRuleOptions`:

```ts
recommendation: string | ((o: RuleOptions) => string);
```

and in `check`, right after resolving `o`:

```ts
const recommendation = typeof opts.recommendation === 'function' ? opts.recommendation(o) : opts.recommendation;
```

Replace every `recommendation: opts.recommendation` in the emitted results with `recommendation`.
Add `import type { RuleOptions } from '../../types.js';` alongside the other imports.

Then switch both rule files to the callable form.
`packages/core/src/rules/seo/title-length.ts`:

```ts
  recommendation: (o) =>
    `Aim for a title of ${o.min as number}–${o.max as number} characters so it is not truncated in search results.`,
```

`packages/core/src/rules/seo/description-length.ts`:

```ts
  recommendation: (o) =>
    `Aim for a meta description of ${o.min as number}–${o.max as number} characters so it is not truncated in search results.`,
```

Leave the rest of the loop body — the `out.push(…)` calls — otherwise untouched.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/rules/seo/length-rule.ts packages/core/test/seo-length-rules.test.ts
git commit -m "feat(core): make the SEO title/description length bounds configurable"
```

---

### Task 6: Extendable lists — `heavy-import` and `preconnect`

**Files:**

- Modify: `packages/core/src/rules/perf/heavy-import.ts`, `packages/core/src/rules/perf/preconnect.ts`
- Test: `packages/core/test/bundle-rules.test.ts` (heavy-import), `packages/core/test/perf-loading-rules.test.ts` (preconnect)

**Interfaces:**

- Consumes: `resolveRuleOptions`, `compileOverrides`, the widened `componentRule` signature (Task 4).
- Produces: `performance/heavy-import` with a `packages` `string-map`; `performance/preconnect` with an `origins` `string-list`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/bundle-rules.test.ts` already defines `comp(importSpans, suppressions?)`,
`ctx(components)` (config hard-coded to `defineConfig({})`) and `fails`. Append this inside its
`describe('performance/heavy-import …')` block — note `comp` takes the spans array positionally,
not an object:

```ts
const cfgCtx = (components: ComponentFacts[], cfg: Parameters<typeof defineConfig>[0]): RuleContext => ({
  components,
  heads: [],
  project: defaultProject,
  config: defineConfig(cfg)
});
const extra = {
  rules: { 'performance/heavy-import': { options: { packages: { 'chart.js': 'import chart.js/auto' } } } }
};

it('still flags the built-in heavy packages', async () => {
  const rs = await performanceHeavyImport.check(ctx([comp([{ source: 'lodash', line: 3 }])]));
  expect(fails(rs)).toHaveLength(1);
});
it('flags a package added through config', async () => {
  const rs = await performanceHeavyImport.check(cfgCtx([comp([{ source: 'chart.js', line: 2 }])], extra));
  expect(fails(rs)).toHaveLength(1);
  expect(fails(rs)[0]!.message).toContain('import chart.js/auto');
});
it('keeps the built-ins when config adds a package', async () => {
  const rs = await performanceHeavyImport.check(cfgCtx([comp([{ source: 'moment', line: 1 }])], extra));
  expect(fails(rs)).toHaveLength(1);
});
it('leaves an unlisted package alone', async () => {
  const rs = await performanceHeavyImport.check(cfgCtx([comp([{ source: 'dayjs', line: 1 }])], extra));
  expect(rs).toHaveLength(0);
});
```

`packages/core/test/perf-loading-rules.test.ts` already defines `head(source, tags)`,
`headsCtx(h)` (config hard-coded to `defineConfig({})`), `link(rel, href)` and `fails`. Append this
inside its `describe('performance/preconnect …')` block:

```ts
const cfgHeadsCtx = (h: ResolvedHead, cfg: Parameters<typeof defineConfig>[0]): RuleContext => ({
  heads: [h],
  project: defaultProject,
  config: defineConfig(cfg)
});
const extra = { rules: { 'performance/preconnect': { options: { origins: ['cdn.example.com'] } } } };

it('flags an origin added through config', async () => {
  const rs = await performancePreconnect.check(
    cfgHeadsCtx(head('rendered', [link('stylesheet', 'https://cdn.example.com/app.css')]), extra)
  );
  expect(fails(rs)).toHaveLength(1);
  expect(rs[0]!.message).toContain('cdn.example.com');
});
it('keeps the built-in origins when config adds one', async () => {
  const rs = await performancePreconnect.check(
    cfgHeadsCtx(head('rendered', [link('stylesheet', 'https://fonts.googleapis.com/css2?x')]), extra)
  );
  expect(fails(rs)).toHaveLength(1);
});
it('emits nothing for an origin on neither list', async () => {
  const rs = await performancePreconnect.check(
    cfgHeadsCtx(head('rendered', [link('stylesheet', 'https://other.example.com/app.css')]), extra)
  );
  expect(rs).toHaveLength(0);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/bundle-rules.test.ts test/perf-loading-rules.test.ts`
Expected: FAIL on the config-added cases — the constants are still hard-coded.

- [ ] **Step 3: Implement `heavy-import`**

In `packages/core/src/rules/perf/heavy-import.ts`, add `options` and read from the resolved value. Keep the `HEAVY_PACKAGES` doc comment verbatim:

```ts
  options: { packages: { kind: 'string-map', default: HEAVY_PACKAGES } },
```

and in `bad`, take the second argument and read the table from it. Keep `Object.hasOwn` — the
existing comment explains why (`in` would match inherited keys like `toString`, and a
user-supplied map is exactly the case where that matters):

```ts
bad: (c, o) => {
  const packages = o.packages as Record<string, string>;
  // `Object.hasOwn` (not `in`) so inherited keys like `toString` never match;
  // dedupe so the same package imported in both scripts isn't double-penalized.
  const seen = new Set<string>();
  const out: { line: number; message: string }[] = [];
  const spans = c.importSpans ?? c.imports.map((source) => ({ source, line: 0 }));
  for (const { source: src, line } of spans) {
    if (!Object.hasOwn(packages, src) || seen.has(src)) continue;
    seen.add(src);
    out.push({ line, message: `Heavy import "${src}" — ${packages[src]}` });
  }
  return out;
};
```

`applies` is unchanged — only the source of the package table moves.

- [ ] **Step 4: Implement `preconnect`**

In `packages/core/src/rules/perf/preconnect.ts`, add the imports:

```ts
import { compileOverrides } from '../../config-apply.js';
import { resolveRuleOptions, type RuleOptionsSpec } from '../../rule-options.js';
```

Above the rule, declare the spec from the existing constant:

```ts
const OPTIONS: RuleOptionsSpec = { origins: { kind: 'string-list', default: [...THIRD_PARTY_ORIGINS] } };
```

Add `options: OPTIONS,` to the rule object (after `fix`), and inside `check` resolve per head, replacing the `THIRD_PARTY_ORIGINS.has(host)` test:

```ts
    const compiled = compileOverrides(ctx.config);
    for (const head of ctx.heads) {
      const o = resolveRuleOptions('performance/preconnect', OPTIONS, ctx.config, { route: head.route }, compiled);
      const origins = new Set(o.origins as string[]);
      ...
        if (!host || !origins.has(host)) continue;
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/rules/perf/heavy-import.ts packages/core/src/rules/perf/preconnect.ts packages/core/test/bundle-rules.test.ts packages/core/test/perf-loading-rules.test.ts
git commit -m "feat(core): let config extend the heavy-import and preconnect lists"
```

---

### Task 7: CLI config-file validation

Note a deliberate strictness increase: today `validateConfigFile` checks `rules` keys but never its _values_ — an invalid severity is assigned straight through. This task validates values in `rules` too, matching what `overrides[].rules` already does.

**Files:**

- Modify: `packages/cli/src/rules-config.ts`
- Modify: `packages/cli/src/config-file.ts:94-166`
- Test: `packages/cli/test/config-file.test.ts`

**Interfaces:**

- Consumes: `validateRuleOptions`, `RuleOptionsSpec` (Task 3); `Rule.options` (Task 4).
- Produces: `ruleOptionsSpec(id): RuleOptionsSpec | undefined` from `rules-config.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/cli/test/config-file.test.ts`, following that file's existing pattern for writing a temp config and asserting on load (reuse its helper; do not invent a new fixture mechanism):

```ts
it('accepts the object form with options', async () => {
  const { config } = await loadConfigFrom(`export default {
    rules: { 'architecture/prop-count': { severity: 'warning', options: { max: 10 } } }
  };`);
  expect(config.rules!['architecture/prop-count']).toEqual({ severity: 'warning', options: { max: 10 } });
});
it('rejects an unknown option key', async () => {
  await expect(
    loadConfigFrom(`export default { rules: { 'architecture/prop-count': { options: { maxx: 10 } } } };`)
  ).rejects.toThrow(/unknown option 'maxx'/);
});
it('rejects options on a rule that takes none', async () => {
  await expect(loadConfigFrom(`export default { rules: { 'seo/charset': { options: { max: 1 } } } };`)).rejects.toThrow(
    /takes no options/
  );
});
it('rejects an out-of-range integer option', async () => {
  await expect(
    loadConfigFrom(`export default { rules: { 'architecture/prop-count': { options: { max: 0 } } } };`)
  ).rejects.toThrow(/must be >= 1/);
});
it('rejects a wrongly-typed option', async () => {
  await expect(
    loadConfigFrom(`export default { rules: { 'architecture/prop-count': { options: { max: '10' } } } };`)
  ).rejects.toThrow(/must be an integer/);
});
it('rejects an unknown key inside a setting object', async () => {
  await expect(
    loadConfigFrom(`export default { rules: { 'architecture/prop-count': { sevrity: 'warning' } } };`)
  ).rejects.toThrow(/unknown key/);
});
it('rejects an invalid severity in the object form', async () => {
  await expect(
    loadConfigFrom(`export default { rules: { 'architecture/prop-count': { severity: 'loud' } } };`)
  ).rejects.toThrow(/invalid setting/);
});
it('rejects options under a category key in overrides', async () => {
  await expect(
    loadConfigFrom(`export default {
      overrides: [{ files: 'src/**', rules: { architecture: { options: { max: 3 } } } }]
    };`)
  ).rejects.toThrow(/options are not allowed on a category key/);
});
it('accepts options in an override entry', async () => {
  const { config } = await loadConfigFrom(`export default {
    overrides: [{ files: 'src/lib/**', rules: { 'architecture/prop-count': { options: { max: 4 } } } }]
  };`);
  expect(config.overrides![0]!.rules['architecture/prop-count']).toEqual({ options: { max: 4 } });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/config-file.test.ts`
Expected: FAIL — the object form is currently either accepted unvalidated or rejected by the `RULE_SETTING_VALUES` check.

- [ ] **Step 3: Add the spec lookup**

Append to `packages/cli/src/rules-config.ts`:

```ts
import { allRules, type RuleOptionsSpec, type RuleSetting } from '@svelte-vitals/core';

const RULE_BY_ID = new Map(allRules.map((r) => [r.id, r]));

/** The options a rule declares, or undefined when it takes none. */
export function ruleOptionsSpec(id: string): RuleOptionsSpec | undefined {
  return RULE_BY_ID.get(id)?.options;
}
```

(Merge the import with the existing `import { allRules, type RuleSetting } from '@svelte-vitals/core';` line rather than adding a second one.)

- [ ] **Step 4: Validate settings in both places**

In `packages/cli/src/config-file.ts`, add the imports:

```ts
import { validateRuleOptions } from '@svelte-vitals/core';
import { findUnknownRuleIds, knownRuleIds, ruleOptionsSpec } from './rules-config.js';
```

Add a shared validator above `validateConfigFile`:

```ts
/**
 * Validate one rule setting — the bare severity string or the object form.
 * `allowOptions` is false for category keys in `overrides[].rules`: a category
 * may carry a severity, but options are rule-specific and meaningless there.
 * Everything here is fatal, on the same reasoning as unknown rule ids — a typo
 * that silently leaves the config inert is the failure being prevented.
 */
function validateSetting(path: string, where: string, key: string, setting: unknown, allowOptions: boolean): void {
  if (typeof setting === 'string') {
    if (!RULE_SETTING_VALUES.includes(setting)) {
      throw new Error(
        `${path}: ${where}.${key}: invalid setting '${setting}'; expected ${RULE_SETTING_VALUES.join('|')}.`
      );
    }
    return;
  }
  if (!isPlainObject(setting)) {
    throw new Error(
      `${path}: ${where}.${key}: must be ${RULE_SETTING_VALUES.join('|')} or an object with 'severity' and/or 'options'.`
    );
  }
  const unknownKeys = Object.keys(setting).filter((k) => k !== 'severity' && k !== 'options');
  if (unknownKeys.length > 0) {
    throw new Error(`${path}: ${where}.${key}: unknown key(s) ${unknownKeys.join(', ')}; expected severity, options.`);
  }
  if (setting.severity !== undefined && !RULE_SETTING_VALUES.includes(setting.severity as string)) {
    throw new Error(
      `${path}: ${where}.${key}.severity: invalid setting '${String(setting.severity)}'; ` +
        `expected ${RULE_SETTING_VALUES.join('|')}.`
    );
  }
  if (setting.options === undefined) return;
  if (!allowOptions) {
    throw new Error(`${path}: ${where}.${key}: options are not allowed on a category key.`);
  }
  if (!isPlainObject(setting.options)) {
    throw new Error(`${path}: ${where}.${key}.options: must be an object.`);
  }
  const errors = validateRuleOptions(key, ruleOptionsSpec(key), setting.options);
  if (errors.length > 0) throw new Error(`${path}: ${where}.${key}: ${errors.join(' ')}`);
}
```

In the `rules` block, after the unknown-id check and before `config.rules = rules`:

```ts
for (const [key, setting] of Object.entries(rules)) validateSetting(path, 'rules', key, setting, true);
```

In the `overrides` block, replace the existing per-setting loop:

```ts
for (const [key, setting] of Object.entries(entry.rules)) {
  const isCategory = CATEGORIES.includes(key as Category);
  validateSetting(path, `overrides[${i}].rules`, key, setting, !isCategory);
}
```

- [ ] **Step 5: Run the CLI suite**

Run: `pnpm --filter svelte-vitals test`
Expected: PASS.

- [ ] **Step 6: Full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/rules-config.ts packages/cli/src/config-file.ts packages/cli/test/config-file.test.ts
git commit -m "feat(cli): validate the object form of rule settings and their options"
```

---

### Task 8: Docs and changeset

**Files:**

- Modify: `docs/src/content/docs/guides/(setup)/configuration.mdx` and `docs/src/content/docs/ja/guides/(setup)/configuration.mdx`
- Modify: 6 rule pages under `docs/src/content/docs/rules/` and their `ja/` mirrors: `architecture/prop-count.md`, `architecture/component-size.md`, `seo/title-length.md`, `seo/description-length.md`, `performance/heavy-import.md`, `performance/preconnect.md`
- Create: `.changeset/<name>.md`

- [ ] **Step 1: Add the configuration-guide section (en)**

In the English `configuration.mdx`, after the existing `rules` section, add a "Rule options" section covering: the object form, that `severity` is optional, that integer options replace while list and map options **add** to the built-in set, and that options work inside `overrides` entries but never on a category key. Include this example:

```js
export default {
  rules: {
    'architecture/prop-count': { options: { max: 10 } },
    'performance/heavy-import': { options: { packages: { 'chart.js': 'import chart.js/auto' } } }
  },
  overrides: [{ files: 'src/lib/**', rules: { 'architecture/prop-count': { options: { max: 4 } } } }]
};
```

Also state which rules accept options and what they are — but **do not write a rule count or an ID range** anywhere (repo convention: such text rots on every new rule).

- [ ] **Step 2: Mirror it in Japanese**

Apply the same section to the `ja/` file. The two files are updated together by convention — an English-only change is not shippable.

- [ ] **Step 3: Add a "Configuration" section to each of the six rule pages (en + ja)**

For each page, state the option name, its kind, and its default. For example, in `docs/src/content/docs/rules/architecture/prop-count.md`:

````markdown
## Configuration

| Option | Type    | Default |
| ------ | ------- | ------: |
| `max`  | integer |       6 |

```js
// svelte-vitals.config.js
export default {
  rules: { 'architecture/prop-count': { options: { max: 10 } } }
};
```
````

For `heavy-import` and `preconnect`, state explicitly that the configured value is **added to** the built-in list, not a replacement.

- [ ] **Step 4: Verify the docs build**

Run: `pnpm --filter docs build`
Expected: PASS. `packages/cli/test/docs-links.test.ts` also guards that every rule keeps both an en and a ja page.

- [ ] **Step 5: Add the changeset**

Run: `pnpm changeset`

Select **minor** for the published packages. Body:

```markdown
Rule settings now accept an object form, `{ severity?, options? }`, alongside the existing
`'off' | Severity` strings. Options let a project move a rule's thresholds or extend its
built-in lists, globally or per path via `overrides`.

Configurable rules: `architecture/prop-count` and `architecture/component-size` (`max`),
`seo/title-length` and `seo/description-length` (`min`, `max`), `performance/heavy-import`
(`packages`), `performance/preconnect` (`origins`). List and map options are **added** to the
built-in set, never replacing it, so new built-in entries keep reaching every project.

Two notes for existing setups. Values in the config file's `rules` map are now validated —
an invalid severity that was previously passed through unchecked is now a fatal config error.
And the `RuleSetting` union has gained a member, which can make an exhaustive `switch` over it
in external TypeScript code non-exhaustive.
```

- [ ] **Step 6: Final verification and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm check:publish`
Expected: all pass.

```bash
git add docs .changeset
git commit -m "docs: document per-rule options"
```

---

## Verification checklist

Before opening a PR, confirm each of these by running the command and reading the output — not by assuming:

- [ ] `pnpm lint` — passes
- [ ] `pnpm typecheck` — passes
- [ ] `pnpm test` — passes
- [ ] `pnpm build` — passes
- [ ] `pnpm check:publish` — passes
- [ ] `pnpm --filter docs build` — passes
- [ ] A config using only the old string forms produces byte-identical results to `main` (spot-check one project with `--reporter json`)
