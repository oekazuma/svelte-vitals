# JSON rule evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `--reporter json` able to answer "did this rule run?", which today it cannot — a rule that
found nothing and a rule that was never selected both produce no trace.

**Architecture:** `JsonReport` gains a top-level `rules` map of rule id → `{ findings, passed }`.
`buildJsonReport`/`formatJsonReport` take an optional fourth parameter carrying the ids of the rules that **ran**,
so a rule that ran and stayed silent still gets an entry — presence is the answer, the counts are detail.
Both channels already compute that list, but neither hands it to the reporter: the CLI computes it in a
different function from the one that formats, and the Vite plugin computes it inside an argument.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), vitest, oxlint + oxfmt, Astro Starlight docs.

**Spec:** `docs/superpowers/specs/2026-08-03-json-rule-evidence-design.md` — read it before Task 1.

## Global Constraints

- **Presence is the answer.** A selected rule that produced no results must still appear, as
  `{ findings: 0, passed: 0 }`. Counting only rules that produced results leaves the two cases this change
  exists to separate looking identical.
- **The fourth parameter is optional**, and omitting it must reproduce today's behaviour exactly — entries
  only for rules that produced results. `buildJsonReport` and `formatJsonReport` are public exports of
  `@svelte-vitals/core`.
- **Not inside `summary`.** `Summary` is shared with the console reporter, the markdown reporter, the CLI
  and the Vite plugin; the new map goes on `JsonReport` instead.
- **`findings` is deliberately redundant** with `routes[].issues[]` + `siteIssues[]`. It is included so
  "did it run and find nothing" is a local question. Do not "simplify" it away.
- **No severity breakdown** — every issue already carries `id` and `severity`, so that grouping is
  derivable locally, unlike `passed`.
- `packages/core/src/` must contain no `node:` imports, no I/O, and no runtime-specific globals.
- **Comments earn their place only when they say something the code cannot** (`AGENTS.md`): a constraint, a
  rejected alternative, a non-local dependency. Prefer one line over three. Why a change was made belongs
  in the commit message, not in a file read every time.
- **en/ja docs ship together.** Write real, idiomatic Japanese.
- **Never name other tools** (linters, plugins, competing products) in code, docs, or commits.
- A changeset is required: this adds a field to a public report shape.
- **Verify commands:** per-package `node_modules/.bin/{vitest,tsc,oxlint,oxfmt}`. A full-workspace `pnpm`
  command fails in this sandbox for a pre-existing reason unrelated to this work (the `docs` package has no
  installed dependencies — CI's `docs` job is that gate). `packages/core` may need `tsup` first so the
  other packages resolve its `dist`.
- **Conventional commits, scoped by package:** `feat(core):`, `feat(cli,vite):`, `docs:`.

## File Structure

| File                                                            | Responsibility                                                       | Task |
| --------------------------------------------------------------- | -------------------------------------------------------------------- | ---- |
| `packages/core/src/reporter/json.ts`                            | `RuleEvidence` type, the `rules` field, the counting                 | 1    |
| `packages/core/test/json-report.test.ts`                        | presence, absence, back-compat, `passed`, suppression                | 1    |
| `packages/cli/src/index.ts`                                     | carry the ran-rule ids on `AnalyzeResult`, pass them to the reporter | 2    |
| `packages/vite/src/analyze.ts`                                  | hoist `selectRules`, pass the ids                                    | 2    |
| `docs/src/content/docs/guides/(reporting)/reporters.md` + `ja/` | document `rules`                                                     | 3    |
| `.changeset/json-rule-evidence.md`                              | release note                                                         | 3    |

---

### Task 1: The `rules` field

**Files:**

- Modify: `packages/core/src/reporter/json.ts` — `JsonReport` (around line 22), `buildJsonReport`
  (around line 33) and `formatJsonReport` (around line 66)
- Test: `packages/core/test/json-report.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - `export interface RuleEvidence { findings: number; passed: number }`
  - `JsonReport.rules: Record<string, RuleEvidence>`
  - `buildJsonReport(results, config, meta, ruleIds?: readonly string[]): JsonReport`
  - `formatJsonReport(results, config, meta, ruleIds?: readonly string[]): string`

  `ruleIds` is **the rules that ran**, not merely those `selectRules` returned — see Task 2, where the two
  turn out to differ. Task 2 calls both four-argument forms.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/json-report.test.ts`. That file already declares `config` and a `results`
fixture at the top — reuse them where they fit rather than redeclaring.

```ts
describe('buildJsonReport — per-rule evidence', () => {
  const passOnly: Result[] = [
    {
      id: 'architecture/unit-entry-file',
      category: 'architecture',
      severity: 'info',
      detection: { presence: 'own', value: 'static' },
      location: 'src/lib/Card/Card.svelte',
      message: 'Unit entry file',
      recommendation: 'r'
    }
  ];

  it('lists a selected rule that produced nothing, which is the whole point', () => {
    // Without this entry, "ran and found nothing" and "was never selected" look identical.
    const report = buildJsonReport([], config, { version: 'x' }, ['architecture/directory-naming']);
    expect(report.rules['architecture/directory-naming']).toEqual({ findings: 0, passed: 0 });
  });

  it('omits a rule that was not selected', () => {
    const report = buildJsonReport(passOnly, config, { version: 'x' }, ['architecture/unit-entry-file']);
    expect(Object.hasOwn(report.rules, 'architecture/directory-naming')).toBe(false);
  });

  it('counts a passing result that appears nowhere in issues', () => {
    // `passed` is the field that cannot be derived: `issues` is filtered to penalized results.
    const report = buildJsonReport(passOnly, config, { version: 'x' }, ['architecture/unit-entry-file']);
    expect(report.rules['architecture/unit-entry-file']).toEqual({ findings: 0, passed: 1 });
    expect(report.routes.flatMap((r) => r.issues)).toHaveLength(0);
    expect(report.siteIssues).toHaveLength(0);
  });

  it('counts findings and passes separately for one rule', () => {
    const mixed: Result[] = [
      ...passOnly,
      {
        id: 'architecture/unit-entry-file',
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        route: 'src/lib/Box',
        location: 'src/lib/Box/index.ts',
        message: 'missing entry file',
        recommendation: 'r'
      }
    ];
    const report = buildJsonReport(mixed, config, { version: 'x' }, ['architecture/unit-entry-file']);
    expect(report.rules['architecture/unit-entry-file']).toEqual({ findings: 1, passed: 1 });
  });

  it('falls back to the rules that produced results when no list is given', () => {
    // Back-compat: an external caller on the three-argument form sees today's information.
    const report = buildJsonReport(passOnly, config, { version: 'x' });
    expect(report.rules).toEqual({ 'architecture/unit-entry-file': { findings: 0, passed: 1 } });
  });

  it('reaches the same shape through formatJsonReport', () => {
    const parsed = JSON.parse(formatJsonReport([], config, { version: 'x' }, ['seo/single-h1']));
    expect(parsed.rules).toEqual({ 'seo/single-h1': { findings: 0, passed: 0 } });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: from `packages/core`, `../../node_modules/.bin/vitest run json-report`
Expected: FAIL — `rules` does not exist on the report, and the fourth argument is a TypeScript error.

- [ ] **Step 3: Implement**

In `packages/core/src/reporter/json.ts`, add the type beside `JsonIssue`:

```ts
/** Per-rule counts. A rule present with `findings: 0` ran and reported nothing; an absent rule was not selected. */
export interface RuleEvidence {
  findings: number;
  passed: number;
}
```

Add the field to `JsonReport`, after `summary`:

```ts
rules: Record<string, RuleEvidence>;
```

Add this helper above `buildJsonReport`:

```ts
function ruleEvidence(
  results: Result[],
  config: Config,
  ruleIds: readonly string[] | undefined
): Record<string, RuleEvidence> {
  const out: Record<string, RuleEvidence> = {};
  // Seeding from the ran-rule list is what separates "ran and found nothing" from "never selected";
  // seeding from results alone would leave both empty.
  for (const id of ruleIds ?? []) out[id] = { findings: 0, passed: 0 };
  for (const r of results) {
    const entry = (out[r.id] ??= { findings: 0, passed: 0 });
    if (isPenalized(r.detection, config.treatDynamicAs)) entry.findings += 1;
    else entry.passed += 1;
  }
  return out;
}
```

Widen both public signatures and thread the parameter:

```ts
export function buildJsonReport(
  results: Result[],
  config: Config,
  meta: { version: string },
  ruleIds?: readonly string[]
): JsonReport {
```

```ts
export function formatJsonReport(
  results: Result[],
  config: Config,
  meta: { version: string },
  ruleIds?: readonly string[]
): string {
  return JSON.stringify(buildJsonReport(results, config, meta, ruleIds), null, 2);
}
```

and add `rules` to the returned object:

```ts
return { version: meta.version, score: health, weights, categories, summary, rules, routes, siteIssues };
```

with `const rules = ruleEvidence(results, config, ruleIds);` alongside the existing `summary` line.

Export the type from `packages/core/src/index.ts` beside the other reporter types — grep for `JsonReport`
to find that export list.

- [ ] **Step 4: Run the tests**

Run: from `packages/core`, `../../node_modules/.bin/vitest run json-report`
Expected: PASS, with the file's pre-existing cases unaffected — `rules` is additive.

- [ ] **Step 5: Prove the seeding is load-bearing**

Delete the `for (const id of ruleIds ?? [])` line and re-run.
Expected: the "lists a selected rule that produced nothing" and "reaches the same shape through
formatJsonReport" tests FAIL. Restore, and confirm `git diff` on `json.ts` is empty.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
cd packages/core && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json
cd ../.. && node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
git add packages/core
git commit -m "feat(core): report per-rule evidence in the JSON report"
```

---

### Task 2: Both channels pass the selected ids

**Files:**

- Modify: `packages/cli/src/index.ts` — `AnalyzeResult` (around line 151), `analyzeProject`'s return
  (around line 195) and the `formatJsonReport` call in `run` (around line 449)
- Modify: `packages/vite/src/analyze.ts` — hoist `selectRules(allRules, config)` out of the `runRules`
  argument (around line 75) and pass the ids at the `formatJsonReport` call (around line 100)
- Test: `packages/cli/test/` and `packages/vite/test/` — the existing analyze/report tests

**Interfaces:**

- Consumes: the four-argument `formatJsonReport` from Task 1.
- Produces: `AnalyzeResult.ruleIds: string[]` — the ids of the rules that ran, after `--category`.

- [ ] **Step 1: Write the failing tests**

The point of this task is that **both** channels wire it, so each needs its own assertion. Add to whichever
existing test file already drives the CLI's json output end to end, and to the Vite plugin's analyze test.
Each must assert that a rule which produced **no results** still appears in `rules` — that is the only
assertion that fails when the list is not passed.

For the Vite side, `analyze` returns an object carrying `jsonReport` as a string, so parse it:

```ts
const parsed = JSON.parse(result.jsonReport);
// A rule with nothing to say still appears, which only holds if analyze passed the selected ids.
expect(Object.hasOwn(parsed.rules, 'seo/single-h1')).toBe(true);
```

For the CLI side, run the json reporter path and assert the same shape. Pick a rule that is on by default
and produces nothing for the fixture, so the assertion is about presence rather than about findings.

- [ ] **Step 2: Run them to verify they fail**

Run the two suites. Expected: FAIL — without the fourth argument, a rule that produced nothing has no entry.

- [ ] **Step 3: Carry the ran-rule ids out of `analyzeProject`**

The CLI computes its rule set in `analyzeProject` but formats the report in `run` — two separate exported
functions, so the list is not in scope where it is needed. It also is not what `selectRules` returns:

```ts
const selected = selectRules(allRules, config);
const rules = opts.categories ? selected.filter((r) => opts.categories!.includes(r.category)) : selected;
```

`--category` narrows the set **after** selection, so `rules` is what ran and `selected` is not. Passing
`selected` would list rules excluded by `--category` as though they had run — the exact confusion this
change exists to remove.

Recomputing in `run` is not an option either: `opts.categories` belongs to `analyzeProject`'s options and
is not carried on its result. So `AnalyzeResult` gains the ids:

```ts
export interface AnalyzeResult {
  results: Result[];
  config: Config;
  version: string;
  /** Ids of the rules that ran, after `--category` narrowing. The JSON report lists these so a rule that found nothing stays distinguishable from one that was never selected. */
  ruleIds: string[];
  warnings: string[];
}
```

and `analyzeProject` returns `ruleIds: rules.map((r) => r.id)` — `rules`, not `selected`.

`AnalyzeResult` is exported, so adding a required field breaks any external caller constructing one as a
literal. Grep the repo for object literals assigned to that type before committing; if the only producers
are `analyzeProject` itself and test fixtures, a required field is correct and stronger than an optional
one.

- [ ] **Step 4: Wire both reporters**

In `run`, pass the carried ids at the `formatJsonReport` call:

```ts
log(formatJsonReport(results, config, { version }, analysis.ruleIds));
```

Use whatever name the local `AnalyzeResult` binding already has rather than introducing a second one.

In `packages/vite/src/analyze.ts`, `selectRules(allRules, config)` is an inline argument to `runRules`.
Hoist it and pass the ids:

```ts
const selected = selectRules(allRules, config);
```

```ts
const jsonReport = formatJsonReport(
  results,
  config,
  { version: readPackageVersion() },
  selected.map((r) => r.id)
);
```

The Vite plugin has **no** `--category` equivalent, so `selected` is what ran there. That asymmetry with
the CLI is why the two channels wire this differently, and why testing only one of them would miss it.

- [ ] **Step 5: Run both suites plus core**

```bash
cd packages/core && ../../node_modules/.bin/tsup && ../../node_modules/.bin/vitest run
cd ../cli && ../../node_modules/.bin/vitest run
cd ../vite && ../../node_modules/.bin/vitest run
```

- [ ] **Step 6: Typecheck, lint, commit**

```bash
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json) || echo "FAIL $p"; done
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
git add packages/cli packages/vite
git commit -m "feat(cli,vite): pass the selected rule ids to the JSON reporter"
```

---

### Task 3: Documentation and changeset

**Files:**

- Modify: `docs/src/content/docs/guides/(reporting)/reporters.md`
- Modify: `docs/src/content/docs/ja/guides/(reporting)/reporters.md`
- Create: `.changeset/json-rule-evidence.md`

**Interfaces:**

- Consumes: the behaviour from Tasks 1-2.
- Produces: nothing.

- [ ] **Step 1: Add `rules` to the documented shape**

The guide's `#### Shape` section carries an annotated `jsonc` example. Add the field after `summary`:

```jsonc
  "rules": {
    // Every rule that ran. An entry with `findings: 0` ran and reported nothing;
    // a rule missing from this map was not selected (`--ignore`, `--rules`, `--category`, or `off`).
    "architecture/unit-entry-file": { "findings": 0, "passed": 12 }
  },
```

Then add a paragraph below the two field-name warnings already there:

```md
`rules` answers a question the rest of the report cannot: **whether a rule ran at all.** `issues` lists
only failing findings, so a rule that found nothing leaves no trace there — and a rule you disabled leaves
the same absence. Look it up in `rules` instead: present means it ran, missing means it was not selected.

The counts describe the report, not the tree. Baseline, suppression and `--diff` filtering are applied
before the report is built, so a rule whose findings were all suppressed shows `findings: 0` while
remaining present.
```

- [ ] **Step 2: Mirror both edits in Japanese**

Apply the equivalent changes at the matching positions in the `ja/` file. Idiomatic Japanese, not a literal
rendering; keep code spans and field names in their original form. The two files must make the same claims.

- [ ] **Step 3: Add the changeset**

Create `.changeset/json-rule-evidence.md`, naming every package that ships the shape:

```md
---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`--reporter json` gains a top-level `rules` map of rule id to `{ findings, passed }`, listing every rule
that ran.

It answers a question the report could not: `issues` lists only failing findings, so a rule that found
nothing left no trace — indistinguishable from a rule that was never selected. A rule present in `rules`
ran; a rule missing from it was not selected. `passed` is also unavailable elsewhere, since `summary` is
project-wide.

The counts describe the report rather than the tree: baseline, suppression and `--diff` filtering are
applied first, so a rule whose findings were all suppressed shows `findings: 0` and stays present.
```

- [ ] **Step 4: Verify**

```bash
node_modules/.bin/oxfmt --write docs .changeset
node_modules/.bin/oxfmt --check .
(cd packages/cli && ../../node_modules/.bin/vitest run docs-links)
```

The docs site build cannot run in this sandbox; check the two `.md` files by eye for valid frontmatter and
balanced fences, and say in your report that the build was not run — CI's `docs` job is the gate.

- [ ] **Step 5: Commit**

```bash
git add docs .changeset
git commit -m "docs: document the JSON report's rules map"
```

---

## Self-Review

**Spec coverage.** The shape and its placement outside `summary` → Task 1 Step 3. The selected-list
parameter and its optionality → Task 1 (signature) and Task 2 (both callers). `findings`/`passed` and the
rejected severity breakdown → Task 1's helper. The filtering semantics → documented in Task 3, tested in
Task 1's mixed-results case. The spec's six test items map as: 1 → "lists a selected rule that produced
nothing"; 2 → "omits a rule that was not selected"; 3 → the back-compat case; 4 → "counts a passing result
that appears nowhere in issues"; 6 → Task 2's two assertions.

**One spec test item is not covered by a task, deliberately.** Spec item 5 asks that suppressed findings go
uncounted while the rule stays present. Suppression is applied in `packages/cli` before the reporter is
called, so at the reporter's own level there is nothing to test — a suppressed result simply is not in
`results`. Testing it means a CLI-level fixture with a suppression directive, which belongs with Task 2's
CLI assertion. **Fold it there**: assert that a rule whose only finding is suppressed appears with
`findings: 0`. Without that, the claim in the docs is unverified.

**Type consistency.** `RuleEvidence` is the name in the type, the helper's return, and the tests.
`ruleIds?: readonly string[]` is the parameter in both public signatures. The CLI passes
`analysis.ruleIds` (carried on `AnalyzeResult`); the Vite plugin passes `selected.map((r) => r.id)` from
its hoisted local.
