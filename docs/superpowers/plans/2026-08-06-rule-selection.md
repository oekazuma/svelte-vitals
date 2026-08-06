# Rule Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `--rules X` runs only X, force-enables it over a config-file `'off'`, **and keeps X's severity and options from the config file** — the third of which is missing today.

**Architecture:** The composition of a run's `rules` map moves out of `analyzeProject` into a pure function, `resolveRuleSelection`, in its own module. `AnalyzeOptions.rules` regains one honest meaning (a complete replacement, which is what the vite plugin and programmatic callers pass), and the CLI's two flags travel as id lists — `allowRules` and `ignoreRules` — instead of a synthesized map that encoded selection as the _absence_ of an entry.

**Tech Stack:** TypeScript, vitest, the `svelte-vitals` CLI package.

Design: `docs/superpowers/specs/2026-08-06-rule-selection-design.md` (approved after adversarial review, 2026-08-06). Read it before Task 1 — the case table is the specification and every row is a required test.

## Global Constraints

- **The line the design draws:** a flag says **which** rules run; the config file says **how** they run. `'off'` is the only setting that is purely selection, so it is the only one a flag overrides. A severity or an options map is configuration and survives.
- **Three properties must hold together.** (1) `--rules X` runs only X. (2) `--rules X` force-enables X over a file `'off'`. (3) `--rules X` keeps X's severity and options. Properties 2 and 3 cannot co-hold while selection is encoded as absence — that is why the encoding changes.
- **`--ignore` must keep the behaviour that shipped in `cb394ced`:** it layers its `'off'` entries rather than replacing the map. Do not undo it.
- **`ignoreRules` is applied last**, which is what keeps deny beating allow. Applying it before the allow-list rewrite lets the force-enable delete resurrect an ignored rule.
- **`allowRules: []` and `ignoreRules: []` mean no narrowing and no denial**, identical to absent. An empty list read as "allow nothing" would run zero rules at exit 0 — the silent shape this whole change exists to remove.
- **An unrecognised id in `allowRules` disables the registry.** The CLI is protected (`resolve-args` rejects unknown ids fatally). A programmatic caller is not. `resolveRuleSelection` takes ids as given and its docstring must say so, pointing at `findUnknownRuleIds`. Do not validate inside the function — the CLI already does it on every run.
- **`packages/core` is not touched by this plan.** No `node:` imports, no I/O, no runtime globals apply, but nothing in core changes.
- **Never name another tool, linter, plugin, product or automated reviewer** in code, tests, docs, changeset, or commit messages. PR bodies are written in English.
- **Verify commands — use these exact invocations.** A `pnpm --filter` run of a whole package suite times out in this sandbox. From the repo root:
  - one test file: `cd packages/cli && ../../node_modules/.bin/vitest run test/<file>.test.ts`
  - whole cli suite: `cd packages/cli && ../../node_modules/.bin/vitest run`
  - whole core suite: `cd packages/core && ../../node_modules/.bin/vitest run`
  - typecheck: `cd packages/<pkg> && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json` (do cli, core and vite)
  - lint: `./node_modules/.bin/oxlint .`
  - format: `./node_modules/.bin/oxfmt --write .` then `./node_modules/.bin/oxfmt --check .`
  - Never run `pnpm install`. Never background a run.
- **`packages/cli/test/io-budget.test.ts`** holds the collection phase to a fixed number of `Runtime` calls. Nothing here should move it; if it does, stop and report rather than editing the number.

---

## File Structure

| File                                                                     | Responsibility                                                                                                                                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/cli/src/rule-selection.ts`                                     | **Create.** `resolveRuleSelection` — the whole composition, as a pure function. One responsibility, no I/O, unit-testable without a project fixture.                                        |
| `packages/cli/test/rule-selection.test.ts`                               | **Create.** The design's case table, one test per row.                                                                                                                                      |
| `packages/cli/src/index.ts`                                              | **Modify.** `AnalyzeOptions`/`RunOptions` gain `allowRules`; `analyzeProject` calls `resolveRuleSelection` in place of the inline composition; three forwarding sites carry the new option. |
| `packages/cli/src/resolve-args.ts`                                       | **Modify.** Emit `allowRules` as an id list instead of calling `buildRulesConfig`; stop emitting `rules`.                                                                                   |
| `packages/cli/src/rules-config.ts`                                       | **Modify.** One docstring line on `buildRulesConfig`: the CLI no longer uses it.                                                                                                            |
| `packages/cli/test/analyze-project.test.ts`, `test/resolve-args.test.ts` | **Modify.** End-to-end and arg-level tests.                                                                                                                                                 |
| `docs/src/content/docs/guides/(setup)/configuration.mdx` + `ja/`         | **Modify.** The `--rules` precedence sentence.                                                                                                                                              |
| `docs/superpowers/specs/2026-07-05-config-file-design.md`                | **Modify.** Extend the existing "Corrected 2026-08-06." note.                                                                                                                               |
| `.changeset/rules-flag-keeps-options.md`                                 | **Create.** Minor for `svelte-vitals`.                                                                                                                                                      |

**`buildRulesConfig` stays exported and its tests stay.** It is public API (`packages/cli/src/index.ts:551` re-exports it), so removing it is a breaking change and a separate decision — not one to make silently inside a behaviour fix. After Task 2 the CLI no longer calls it; the docstring says so and points at `resolveRuleSelection`. Whether to deprecate or remove it is recorded as out of scope, not forgotten.

---

## Task 1: The pure function, and `analyzeProject` using it

**Files:**

- Create: `packages/cli/src/rule-selection.ts`
- Create: `packages/cli/test/rule-selection.test.ts`
- Modify: `packages/cli/src/index.ts` (the `AnalyzeOptions` and `RunOptions` interfaces; `analyzeProject`'s composition at ~194-201; the three forwarding sites at ~357, ~407, ~454)
- Modify: `packages/cli/test/analyze-project.test.ts`

**Interfaces:**

- Consumes: `allRules` and `type RuleSetting` from `@svelte-vitals/core` (already imported by `packages/cli/src/rules-config.ts` — same import path).
- Produces:
  ```ts
  export interface RuleSelectionInput {
    fileRules?: Record<string, RuleSetting>;
    rules?: Record<string, RuleSetting>;
    allowRules?: string[];
    ignoreRules?: string[];
  }
  export function resolveRuleSelection(input: RuleSelectionInput): Record<string, RuleSetting>;
  ```
  Task 2 relies on `AnalyzeOptions.allowRules?: string[]` and `RunOptions.allowRules?: string[]` existing after this task.

This task does **not** change what the CLI does — `resolve-args` still emits a synthesized `rules` map until Task 2, and `opts.allowRules` is undefined on every CLI path. The new code path is exercised by programmatic tests. That is deliberate: it keeps this task's diff reviewable and leaves no intermediate state where the CLI is broken.

- [ ] **Step 1: Write the failing unit tests**

Create `packages/cli/test/rule-selection.test.ts`. One test per row of the design's case table, plus the two rows the review added:

```ts
import { describe, expect, it } from 'vitest';
import { resolveRuleSelection } from '../src/rule-selection.js';

const X = 'architecture/component-size';
const Y = 'seo/title-presence';

describe('resolveRuleSelection', () => {
  it('returns the file map unchanged when neither flag list is given', () => {
    const fileRules = { [X]: { options: { max: 3 } } } as const;
    expect(resolveRuleSelection({ fileRules })).toEqual(fileRules);
  });

  it('treats empty flag lists as no narrowing and no denial', () => {
    const fileRules = { [X]: { options: { max: 3 } } } as const;
    expect(resolveRuleSelection({ fileRules, allowRules: [], ignoreRules: [] })).toEqual(fileRules);
  });

  it('leaves a named rule absent when the file has no entry for it', () => {
    const out = resolveRuleSelection({ allowRules: [X] });
    expect(Object.hasOwn(out, X)).toBe(false);
  });

  it('keeps a named rule severity from the file', () => {
    const out = resolveRuleSelection({ fileRules: { [X]: 'warning' }, allowRules: [X] });
    expect(out[X]).toBe('warning');
  });

  it('keeps a named rule options object from the file', () => {
    const out = resolveRuleSelection({ fileRules: { [X]: { options: { max: 3 } } }, allowRules: [X] });
    expect(out[X]).toEqual({ options: { max: 3 } });
  });

  it('drops a bare off so a named rule is force-enabled', () => {
    const out = resolveRuleSelection({ fileRules: { [X]: 'off' }, allowRules: [X] });
    expect(Object.hasOwn(out, X)).toBe(false);
  });

  it('force-enables a named rule without losing the options beside its off', () => {
    const out = resolveRuleSelection({
      fileRules: { [X]: { severity: 'off', options: { max: 3 } } },
      allowRules: [X]
    });
    expect(out[X]).toEqual({ options: { max: 3 } });
  });

  it('drops an object setting that carried nothing but off', () => {
    const out = resolveRuleSelection({ fileRules: { [X]: { severity: 'off' } }, allowRules: [X] });
    expect(Object.hasOwn(out, X)).toBe(false);
  });

  it('turns off every registered rule the allow-list does not name', () => {
    const out = resolveRuleSelection({ fileRules: { [Y]: 'warning' }, allowRules: [X] });
    expect(out[Y]).toBe('off');
  });

  it('lets deny beat allow when both name the same rule', () => {
    const out = resolveRuleSelection({ fileRules: { [X]: 'off' }, allowRules: [X], ignoreRules: [X] });
    expect(out[X]).toBe('off');
  });

  it('layers ignore onto the file map without replacing it', () => {
    const out = resolveRuleSelection({
      fileRules: { [X]: { options: { max: 3 } }, [Y]: 'warning' },
      ignoreRules: [Y]
    });
    expect(out[X]).toEqual({ options: { max: 3 } });
    expect(out[Y]).toBe('off');
  });

  it('lets an explicit rules map replace the file map, then narrows it', () => {
    const out = resolveRuleSelection({
      fileRules: { [X]: { options: { max: 3 } } },
      rules: { [X]: 'warning', [Y]: 'warning' },
      allowRules: [X]
    });
    expect(out[X]).toBe('warning'); // from `rules`, not the file's options object
    expect(out[Y]).toBe('off'); // narrowed away
  });

  it('does not mutate its inputs', () => {
    const fileRules = { [X]: 'off' as const };
    resolveRuleSelection({ fileRules, allowRules: [X] });
    expect(fileRules[X]).toBe('off');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/cli && ../../node_modules/.bin/vitest run test/rule-selection.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the function**

Create `packages/cli/src/rule-selection.ts`:

```ts
import { allRules, type RuleSetting } from '@svelte-vitals/core';

export interface RuleSelectionInput {
  /** The config file's `rules` map, when a config file was loaded. */
  fileRules?: Record<string, RuleSetting>;
  /**
   * A complete replacement for `fileRules` — what the Vite plugin and programmatic callers pass.
   * Whole-field, per the per-field precedence every other config field follows.
   */
  rules?: Record<string, RuleSetting>;
  /** `--rules`: run only these rule ids. Selection, not configuration. */
  allowRules?: string[];
  /** `--ignore`: silence these rule ids. Selection, not configuration. */
  ignoreRules?: string[];
}

/**
 * The `rules` map a run is analyzed with.
 *
 * A flag says *which* rules run; the config file says *how* they run. `'off'` is the only setting
 * that is purely selection, so it is the only one a flag overrides — a severity or an options map
 * is configuration and survives `--rules` naming its rule. That is what selection encoded as the
 * *absence* of an entry could not express: the one slot had to mean both "no entry, so enabled"
 * and "an entry, so configured" (design 2026-08-06).
 *
 * `ignoreRules` is applied last. Applying it before the allow-list rewrite would let the
 * force-enable delete resurrect a rule `--ignore` named.
 *
 * Ids are taken as given. **An id in `allowRules` that no registered rule matches turns every rule
 * off**, so callers owe `findUnknownRuleIds` first; the CLI does this fatally in `resolve-args`.
 */
export function resolveRuleSelection(input: RuleSelectionInput): Record<string, RuleSetting> {
  const out: Record<string, RuleSetting> = { ...(input.rules ?? input.fileRules) };

  const allow = input.allowRules ?? [];
  if (allow.length > 0) {
    const allowed = new Set(allow);
    for (const rule of allRules) if (!allowed.has(rule.id)) out[rule.id] = 'off';
    for (const id of allowed) {
      const setting = out[id];
      if (setting === undefined) continue;
      if (setting === 'off') {
        delete out[id];
      } else if (typeof setting === 'object' && setting.severity === 'off') {
        const { severity: _forceEnabled, ...rest } = setting;
        // An object that carried nothing but `severity: 'off'` has no configuration left to keep.
        if (Object.keys(rest).length === 0) delete out[id];
        else out[id] = rest;
      }
    }
  }

  for (const id of input.ignoreRules ?? []) out[id] = 'off';
  return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/cli && ../../node_modules/.bin/vitest run test/rule-selection.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Verify each branch is load-bearing**

One at a time, break the branch and confirm exactly the named test fails, then restore:

| Break                                                           | Test that must fail                                                    |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `if (allow.length > 0)` → `if (input.allowRules !== undefined)` | "treats empty flag lists as no narrowing and no denial"                |
| `delete out[id]` on the bare-`'off'` branch removed             | "drops a bare off so a named rule is force-enabled"                    |
| the `typeof setting === 'object'` branch removed                | "force-enables a named rule without losing the options beside its off" |
| `Object.keys(rest).length === 0` check removed                  | "drops an object setting that carried nothing but off"                 |
| the `ignoreRules` loop moved above the allow-list block         | "lets deny beat allow when both name the same rule"                    |
| `input.rules ?? input.fileRules` → `input.fileRules`            | "lets an explicit rules map replace the file map, then narrows it"     |
| the spread in `{ ...(…) }` removed (mutate in place)            | "does not mutate its inputs"                                           |

If any break causes **no** failure, the test is vacuous — fix the test and say so in your report.

- [ ] **Step 6: Add `allowRules` to the option types and wire the function in**

In `packages/cli/src/index.ts`, add to **both** `RunOptions` (~line 61, beside the existing `ignoreRules`) and `AnalyzeOptions` (~line 146, likewise):

```ts
  /** `--rules`: run only these rule ids. Selection; the config file still supplies their options. */
  allowRules?: string[];
```

Replace the composition in `analyzeProject` (the `rulesBase` / `resolvedRules` block at ~194-201, and the `rules:` line in the `defineConfig` call) with:

```ts
    rules: resolveRuleSelection({
      fileRules: file?.rules,
      rules: opts.rules,
      allowRules: opts.allowRules,
      ignoreRules: opts.ignoreRules
    }),
```

Add the import at the top of the file, alongside the other local imports:

```ts
import { resolveRuleSelection } from './rule-selection.js';
```

Then add `allowRules: opts.allowRules,` beside each existing `ignoreRules: opts.ignoreRules,` — there are three, at roughly lines 357, 407 and 454. **Grep afterwards** to confirm you got all of them:

```bash
grep -n "ignoreRules: opts.ignoreRules" packages/cli/src/index.ts
grep -n "allowRules: opts.allowRules" packages/cli/src/index.ts
```

Both greps must return the same line count. A forwarding path that carries one and not the other makes the change work in one code path and silently not in another — this defect's own shape.

- [ ] **Step 7: Write the programmatic end-to-end tests**

Append to `packages/cli/test/analyze-project.test.ts`, inside a new `describe`. The fixture `packages/cli/test/fixtures/rules-flag-config-project` already exists — its config declares `architecture/component-size` with `options: { max: 3 }` and `architecture/directory-naming` with a `directories` map, and both only report when the file's `rules` survives. Read the existing `penalizedComponentSize` helper in that file and reuse it.

```ts
describe('allowRules keeps the named rules configured', () => {
  it('runs a named rule with the config file options it declared', async () => {
    const { results } = await analyzeProject({
      cwd: rulesFlagConfigFixtureDir,
      allowRules: ['architecture/component-size']
    });
    expect(penalizedComponentSize(results)).toHaveLength(1);
  });

  it('narrows to the named rule only', async () => {
    const { results } = await analyzeProject({
      cwd: rulesFlagConfigFixtureDir,
      allowRules: ['architecture/component-size']
    });
    expect([...new Set(results.map((r) => r.id))]).toEqual(['architecture/component-size']);
  });

  it('lets an explicit rules map still replace the file map as a whole', async () => {
    const { config } = await analyzeProject({
      cwd: rulesFlagConfigFixtureDir,
      rules: { 'seo/title-presence': 'off' }
    });
    expect(config.rules).toEqual({ 'seo/title-presence': 'off' });
  });
});
```

The third test is the design's testing item 8: it pins the contract `rules` is handed back, which nothing else in this plan would catch — an implementation that merged `opts.rules` over the file map passes every other test here.

- [ ] **Step 8: Run the tests, then the whole cli suite**

Run: `cd packages/cli && ../../node_modules/.bin/vitest run test/analyze-project.test.ts` then `../../node_modules/.bin/vitest run`
Expected: both PASS. Every pre-existing test must still pass — the CLI's behaviour is unchanged in this task.

- [ ] **Step 9: Typecheck, lint, format**

Run, from the repo root: `cd packages/cli && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`, then from the root `./node_modules/.bin/oxlint .` and `./node_modules/.bin/oxfmt --write .` followed by `--check .`

- [ ] **Step 10: Commit**

```bash
git add packages/cli/src/rule-selection.ts packages/cli/test/rule-selection.test.ts packages/cli/src/index.ts packages/cli/test/analyze-project.test.ts
git commit -m "feat(cli): compose a run's rules map in a pure function"
```

---

## Task 2: The CLI passes id lists

**Files:**

- Modify: `packages/cli/src/resolve-args.ts` (the block at ~228-242, and the returned options object at ~255-262)
- Modify: `packages/cli/src/rules-config.ts` (`buildRulesConfig`'s docstring only)
- Modify: `packages/cli/test/resolve-args.test.ts`
- Modify: `packages/cli/test/analyze-project.test.ts`
- Create: `packages/cli/test/fixtures/dead-declaration-project/` — a copy of the shape of
  `rules-flag-config-project` (read that fixture and mirror its `package.json` and `src/` layout), whose
  `svelte-vitals.config.mjs` declares `'architecture/reserved-name-placement': { options: { placements: { e2e:
'src/nowhere/**' } } }`. The glob matches no directory, so the rule emits its aggregated
  project-scoped diagnostic — which the defect silences along with everything else. Add a header comment
  saying that is what the fixture is for. Export a `deadDeclarationFixtureDir` constant beside the existing
  `rulesFlagConfigFixtureDir` in `analyze-project.test.ts`.

**Interfaces:**

- Consumes: `AnalyzeOptions.allowRules?: string[]` and `resolveRuleSelection` from Task 1.
- Produces: nothing new; after this task `--rules` behaves as the design specifies.

This is where the observable CLI behaviour changes.

- [ ] **Step 1: Write the failing CLI-level tests**

Append to the `describe` in `packages/cli/test/analyze-project.test.ts` that already holds the `--ignore` tests and uses the `optionsFor(...args)` helper (it wraps `mri` + `resolveArgs`; read it before writing):

```ts
it('runs a rule named by --rules with the options the config file declared', async () => {
  const options = optionsFor('--rules', 'architecture/component-size');
  const { results } = await analyzeProject({ ...options, cwd: rulesFlagConfigFixtureDir });
  expect(penalizedComponentSize(results)).toHaveLength(1);
});

it('wakes an L3 rule named by --rules using the config file declaration', async () => {
  const options = optionsFor('--rules', 'architecture/directory-naming');
  const { results } = await analyzeProject({ ...options, cwd: rulesFlagConfigFixtureDir });
  expect(results.filter((r) => r.id === 'architecture/directory-naming')).toHaveLength(1);
});

it('restores the self-diagnostic a discarded declaration silenced', async () => {
  // The field's report: the defect was doubly silent. The rule reported nothing AND the
  // aggregated "this declaration does not check what it says" finding disappeared with it,
  // because a discarded options map leaves no declaration to diagnose. So a dead glob and a
  // complying tree looked identical — the exact reading the charter's inverse-precision gate
  // exists to prevent. Uses its own fixture, whose config declares a glob matching nothing.
  const options = optionsFor('--rules', 'architecture/reserved-name-placement');
  const { results } = await analyzeProject({ ...options, cwd: deadDeclarationFixtureDir });
  const projectScoped = results.filter((r) => r.route === undefined && r.location === undefined);
  expect(projectScoped).toHaveLength(1);
  expect(projectScoped[0]?.message).toContain('matched no directory');
});

it('still narrows to the rules --rules names', async () => {
  const options = optionsFor('--rules', 'architecture/component-size');
  const { results } = await analyzeProject({ ...options, cwd: rulesFlagConfigFixtureDir });
  expect([...new Set(results.map((r) => r.id))]).toEqual(['architecture/component-size']);
});

it('lets --ignore beat --rules when both name the same rule', async () => {
  const options = optionsFor('--rules', 'architecture/component-size', '--ignore', 'architecture/component-size');
  const { results } = await analyzeProject({ ...options, cwd: rulesFlagConfigFixtureDir });
  expect(results.filter((r) => r.id === 'architecture/component-size')).toEqual([]);
});
```

The force-enable guard already exists in this file from the `--ignore` fix — the test asserting `--rules` fires a rule the config file sets to `'off'`. **Do not remove or weaken it.** It is the direction a plain merge broke, and it must still pass after this task.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/cli && ../../node_modules/.bin/vitest run test/analyze-project.test.ts`
Expected: the first two FAIL with zero findings — that is the defect. The third and fourth pass already.

- [ ] **Step 3: Emit id lists from `resolve-args`**

In `packages/cli/src/resolve-args.ts`, replace the `rulesConfig` / `rules` block (~236-240) with:

```ts
// Both flags are selection, and both travel as id lists: `--rules` names what runs and
// `--ignore` names what does not, and neither says anything about how the rules it leaves
// enabled are configured. Synthesizing a `rules` map here is what made selection depend on the
// absence of an entry, which a config file's own map could not survive (design 2026-08-06).
// Empty means "not specified" for both, kept distinguishable from "specified as empty".
const allowRules = allow.length > 0 ? allow : undefined;
const ignoreRules = ignore.length > 0 ? ignore : undefined;
```

Remove `buildRulesConfig` from the import at the top of the file (keep `findUnknownRuleIds` and `knownRuleIds` — the unknown-id check above still uses both, and it is what protects the CLI from an id that would disable the registry).

In the returned options object, replace the `rules` spread with `allowRules`, keeping `ignoreRules` as it is:

```ts
      ...(allowRules !== undefined ? { allowRules } : {}),
      ...(ignoreRules !== undefined ? { ignoreRules } : {}),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/cli && ../../node_modules/.bin/vitest run test/analyze-project.test.ts` then `../../node_modules/.bin/vitest run test/resolve-args.test.ts`
Expected: `analyze-project` PASS. `resolve-args` will FAIL where it asserts on the old `rules` field — Step 5 fixes those.

- [ ] **Step 5: Update the arg-level tests**

`packages/cli/test/resolve-args.test.ts` has tests asserting the shape of the synthesized `rules` map, including one at ~line 143 whose comment names `buildRulesConfig`. Rewrite them for the new fields:

```ts
it('carries --rules as an id list and leaves rules unset', () => {
  const options = resolve('--rules', 'seo/title-presence').options;
  expect(options?.allowRules).toEqual(['seo/title-presence']);
  expect(options?.rules).toBeUndefined();
});

it('carries --ignore as an id list, independent of --rules', () => {
  const options = resolve('--ignore', 'seo/canonical-url').options;
  expect(options?.ignoreRules).toEqual(['seo/canonical-url']);
  expect(options?.allowRules).toBeUndefined();
});

it('carries both id lists when both flags are passed', () => {
  const options = resolve('--rules', 'seo/title-presence', '--ignore', 'seo/canonical-url').options;
  expect(options?.allowRules).toEqual(['seo/title-presence']);
  expect(options?.ignoreRules).toEqual(['seo/canonical-url']);
});

it('leaves every rule-selection field undefined when neither flag is passed', () => {
  const options = resolve().options;
  expect(options?.rules).toBeUndefined();
  expect(options?.allowRules).toBeUndefined();
  expect(options?.ignoreRules).toBeUndefined();
});
```

Use the file's existing `resolve(...)` helper rather than a new one, and keep the existing unknown-id tests untouched — they still guard the check that protects the registry.

- [ ] **Step 6: Note that `buildRulesConfig` is no longer used internally**

In `packages/cli/src/rules-config.ts`, add one line to `buildRulesConfig`'s docstring. Do not change its behaviour, its signature, or its tests, and do not remove the export — it is public API (`packages/cli/src/index.ts` re-exports it) and removing it is a separate decision.

```
 * No longer used by the CLI: `resolve-args` passes `--rules`/`--ignore` as id lists and
 * `rule-selection.ts` composes the map. Kept because this is exported API.
```

- [ ] **Step 7: Confirm every path, then run everything**

```bash
grep -n "allowRules" packages/cli/src/index.ts packages/cli/src/resolve-args.ts
grep -rn "buildRulesConfig" packages/cli/src/
```

The first must show `allowRules` on every site that carries `ignoreRules`. The second must show only `rules-config.ts` itself and the re-export in `index.ts`.

Then: `cd packages/cli && ../../node_modules/.bin/vitest run`, `cd ../core && ../../node_modules/.bin/vitest run`, `cd ../vite && ../../node_modules/.bin/vitest run`, then typecheck all three, then lint and format from the root.

- [ ] **Step 8: Verify the fix end to end against a real project**

Build and run the CLI against the fixture directly, so the behaviour is confirmed outside vitest:

```bash
cd packages/core && ../../node_modules/.bin/tsup && cd ../cli && ../../node_modules/.bin/tsup
node dist/bin.js test/fixtures/rules-flag-config-project --rules architecture/component-size --reporter json
```

Expect a finding from `architecture/component-size` and no other rule id in the output. Record what you observed in your report.

- [ ] **Step 9: Commit**

```bash
git add packages/cli/src/resolve-args.ts packages/cli/src/rules-config.ts packages/cli/test/resolve-args.test.ts packages/cli/test/analyze-project.test.ts
git commit -m "fix(cli): keep a named rule's config-file options under --rules"
```

---

## Task 3: Documentation and changeset

**Files:**

- Modify: `docs/src/content/docs/guides/(setup)/configuration.mdx` (~line 228)
- Modify: the Japanese counterpart under `docs/src/content/docs/ja/guides/`
- Modify: `docs/superpowers/specs/2026-07-05-config-file-design.md` (the existing "Corrected 2026-08-06." note in §3)
- Create: `.changeset/rules-flag-keeps-options.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Correct the user-facing precedence sentence**

`configuration.mdx` currently says, at ~line 228, that `rules` is replaced as a whole and that passing `--rules` or `--ignore` makes the flag-built set replace the config file's `rules` entirely. The `--ignore` half was already corrected. Rewrite the remainder so it says what the code now does:

- `--rules` selects **which** rules run and overrides a config-file `'off'` for the rules it names.
- The severities and options declared for those rules are **inherited from the config file**.
- `--ignore` silences the rules it names and leaves every other rule's configuration alone.
- An explicit `rules` value passed programmatically or as a Vite plugin option still replaces the file's map as a whole.

Read the surrounding section first and match its voice; do not restructure the page.

- [ ] **Step 2: Mirror it in Japanese**

Find the corresponding passage in the Japanese page and make the same change, reusing that page's existing terminology for `--rules`, `--ignore`, 設定ファイル and 優先順位 rather than inventing new wording. The two pages must stay parallel — same claims, same order.

- [ ] **Step 3: Extend the design-doc note**

`docs/superpowers/specs/2026-07-05-config-file-design.md` §3 already carries a "**Corrected 2026-08-06.**" note saying the whole-field-replacement reasoning holds for `--rules` and not for `--ignore`. This change alters the `--rules` half, so **extend that note — do not add a second one**. Two notes disagreeing about whether `--rules` replaces is worse than the original error. The extension should say: the reasoning was sound under the encoding it described — selection expressed as the absence of an entry — and it is that encoding which has been replaced, so `--rules` now overrides selection while inheriting configuration.

- [ ] **Step 4: Write the changeset**

`pnpm changeset` is interactive and unavailable. Write `.changeset/rules-flag-keeps-options.md` by hand, following the shape of `.changeset/ignore-flag-config-options.md`. **Minor**, `svelte-vitals` only — `@svelte-vitals/core` and `@svelte-vitals/vite` are untouched.

The body must say: `--rules` previously ran the named rules at built-in defaults, discarding the severities and options the config file declared for them, so an option-configured rule could not be run alone; for a rule that is inert until its convention is declared this meant it reported nothing at exit 0. It now inherits that configuration while still narrowing the run and still overriding a config-file `'off'`.

- [ ] **Step 5: Run the docs gates and format**

```bash
cd packages/cli && ../../node_modules/.bin/vitest run test/docs-links.test.ts test/rules-index.test.mjs test/docs-embed.test.mjs
```

Then from the root: `./node_modules/.bin/oxfmt --write .` and `--check .`, and `./node_modules/.bin/oxlint .`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: state that --rules inherits a named rule's configuration"
```

---

## Self-Review

**Spec coverage.** The design's testing items map as follows: item 1 (every case-table row) → Task 1 Step 1, thirteen unit tests; item 2 (force-enable end to end) → the pre-existing test Task 2 Step 1 must not weaken; item 3 (an option-configured rule fires) → Task 2 Step 1, first two tests; item 4 (still narrows) → Task 2 Step 1, third test, asserting the id set; item 5 (`--ignore` still layers) → the pre-existing `--ignore` tests, which Task 1 Step 8 and Task 2 Step 7 require to keep passing; item 6 (deny beats allow, and the ordering) → Task 1's unit test plus Task 2 Step 1's fourth test, with the ordering pinned by Task 1 Step 5's mutation row; item 7 (every forwarding path) → Task 1 Step 6's paired greps and Task 2 Step 7; item 8 (`rules` still replaces whole) → Task 1 Step 7, third test; item 9 (`rules` + `allowRules`) → Task 1 Step 1, "lets an explicit rules map replace the file map, then narrows it".

The design's other requirements: the `'off'`-is-selection line is the function's three rewrite branches; empty-list semantics are a unit test and the `allow.length > 0` guard; the unknown-id obligation is the docstring in Task 1 Step 3; the documentation changes and the note extension are Task 3.

**Deliberately not implemented**, matching the design's "deliberately not solved": `config.overrides` still suppresses per-path and no flag reaches into it; `--rules X --category <other>` still runs nothing at exit 0; no warning is emitted when a flag narrows to nothing. Also not done: removing or deprecating `buildRulesConfig`, recorded in the File Structure section with its reason.
