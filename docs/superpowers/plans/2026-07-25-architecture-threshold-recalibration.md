# Architecture Threshold Recalibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lower the two Architecture rule thresholds to values derived from measuring real Svelte code — `architecture/prop-count` from 10 to 6, `architecture/component-size` from 400 to 200 — and record the derivation so the numbers cannot drift back to guesses.

**Architecture:** Each rule is a `componentRule({...})` whose threshold is a module-level constant that the detection predicate and the `recommendation` string both read. The change is the constant's value plus a doc comment recording the corpus, statistic, and date. No detection logic, severity, scope, or fact-collection changes.

**Tech Stack:** TypeScript, Vitest.

Design doc: [docs/superpowers/specs/2026-07-25-architecture-threshold-recalibration-design.md](../specs/2026-07-25-architecture-threshold-recalibration-design.md)

## Global Constraints

- **Thresholds**: `MAX_PROPS = 6` in `packages/core/src/rules/architecture/prop-count.ts`; `MAX_LOC = 200` in `packages/core/src/rules/architecture/component-size.ts`. Both rules fire on `> threshold`.
- **Nothing else about either rule changes**: both stay `severity: 'info'`, both stay component-scoped, and the detection predicates keep their current shape. The `recommendation` strings already interpolate the constants, so they update themselves — do not hand-edit the interpolated number into them.
- **Core purity**: no `node:` imports, no I/O, no runtime-specific globals in `packages/core/src/`.
- **Doc pages must stay in sync**: `docs/src/content/docs/rules/architecture/` (en) and `docs/src/content/docs/ja/rules/architecture/` (ja) are updated together.
- **Changeset required** — `minor` for `@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/vite`, `@svelte-vitals/mcp`. This is a visible behaviour change, not a bug fix: existing projects will see new `info` findings and a lower Architecture score (each `info` finding deducts 1 point).
- **Historical CHANGELOG entries are not edited.** `packages/*/CHANGELOG.md` lines mentioning "over 400 lines" / "more than 10 props" describe what those releases actually did and stay as they are.
- All shell commands assume the repository root as the working directory.

---

### Task 1: Lower the `prop-count` threshold to 6

**Files:**

- Modify: `packages/core/src/rules/architecture/prop-count.ts`
- Modify: `packages/core/test/architecture-rules.test.ts`

**Interfaces:**

- Produces: `MAX_PROPS = 6` — the value Task 3's documentation and changeset quote.

The existing tests use `propCount: 15` (flagged) and `propCount: 3` (passes). Both produce the same verdict under 10 and under 6, so they pass either way and pin nothing. The boundary cases below are what actually hold the number.

- [ ] **Step 1: Write the failing boundary tests**

In `packages/core/test/architecture-rules.test.ts`, add these two cases inside the existing `describe('architecture/prop-count prop count', ...)` block, directly after the `'passes a component with few props'` case:

```ts
it('passes a component at exactly the threshold', async () => {
  const rs = await architecturePropCount.check(ctx([comp({ propCount: 6 })]));
  expect(fails(rs)).toHaveLength(0);
  expect(rs).toHaveLength(1);
});
it('flags a component one prop over the threshold', async () => {
  const rs = await architecturePropCount.check(ctx([comp({ propCount: 7 })]));
  expect(fails(rs)).toHaveLength(1);
  expect(rs[0]!.message).toContain('7');
  expect(rs[0]!.message).toContain('over 6');
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/architecture-rules.test.ts`
Expected: FAIL. `'passes a component at exactly the threshold'` already passes (6 is under the current 10), but `'flags a component one prop over the threshold'` fails — with `MAX_PROPS = 10`, a component with 7 props is not flagged, so `fails(rs)` is empty and the length assertion fails.

- [ ] **Step 3: Lower the constant and record its derivation**

In `packages/core/src/rules/architecture/prop-count.ts`, replace the constant and its one-line comment:

```ts
/** More destructured props than this suggests the component is doing too much. */
const MAX_PROPS = 10;
```

with:

```ts
/**
 * More destructured props than this suggests the component is doing too much.
 *
 * Derived empirically (2026-07-25): the median of the per-repository 90th percentile across
 * 2,239 countable components in 7 real Svelte 5 codebases (4 libraries, 3 applications) — see
 * docs/superpowers/specs/2026-07-25-architecture-threshold-recalibration-design.md for the
 * corpus and method. Pooling every repository into one distribution instead gives 9, but that
 * figure is set by a single outlier project contributing 56% of the sample.
 */
const MAX_PROPS = 6;
```

Change nothing else in the file. `recommendation` and the `bad()` message both interpolate `MAX_PROPS`, so they pick the new value up on their own.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/architecture-rules.test.ts`
Expected: PASS, 9 cases in the file (its original 7 plus the 2 added here).

- [ ] **Step 5: Run the full core suite and typecheck**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS. If another test in the package fails, it was relying on the old threshold — report which one rather than adjusting the threshold.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/rules/architecture/prop-count.ts packages/core/test/architecture-rules.test.ts
git commit -m "fix(core): lower architecture/prop-count threshold to 6 from measured data"
```

---

### Task 2: Lower the `component-size` threshold to 200

**Files:**

- Modify: `packages/core/src/rules/architecture/component-size.ts`
- Modify: `packages/core/test/architecture-rules.test.ts`

**Interfaces:**

- Consumes: nothing from Task 1 — the two rules are independent files.
- Produces: `MAX_LOC = 200` — the value Task 3's documentation and changeset quote.

Same situation as Task 1: the existing `loc: 500` / `loc: 50` cases give the same verdict under 400 and under 200, so they pin nothing.

- [ ] **Step 1: Write the failing boundary tests**

In `packages/core/test/architecture-rules.test.ts`, add these two cases inside the existing `describe('architecture/component-size component size', ...)` block, directly after the `'passes a small component'` case:

```ts
it('passes a component at exactly the line limit', async () => {
  const rs = await architectureComponentSize.check(ctx([comp({ loc: 200 })]));
  expect(fails(rs)).toHaveLength(0);
  expect(rs).toHaveLength(1);
});
it('flags a component one line over the limit', async () => {
  const rs = await architectureComponentSize.check(ctx([comp({ loc: 201 })]));
  expect(fails(rs)).toHaveLength(1);
  expect(rs[0]!.message).toContain('201');
  expect(rs[0]!.message).toContain('over 200');
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/architecture-rules.test.ts`
Expected: FAIL. `'passes a component at exactly the line limit'` already passes (200 is under the current 400), but `'flags a component one line over the limit'` fails — with `MAX_LOC = 400`, a 201-line component is not flagged.

- [ ] **Step 3: Lower the constant and record its derivation**

In `packages/core/src/rules/architecture/component-size.ts`, replace the constant and its one-line comment:

```ts
/** A component longer than this many lines is a "god component" smell. */
const MAX_LOC = 400;
```

with:

```ts
/**
 * A component longer than this many lines is a "god component" smell.
 *
 * Derived empirically (2026-07-25) from the same corpus as architecture/prop-count: across 7
 * real Svelte 5 codebases the median per-repository 90th percentile is 124 lines and the 95th
 * is 179 — see docs/superpowers/specs/2026-07-25-architecture-threshold-recalibration-design.md.
 * This threshold sits deliberately above both: a long component is a weaker signal than a wide
 * prop list, since tables, forms, and generated markup are legitimately long.
 */
const MAX_LOC = 200;
```

Change nothing else in the file.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/architecture-rules.test.ts`
Expected: PASS (11 cases: the file's original 7 plus 2 from Task 1 plus 2 here).

- [ ] **Step 5: Run the full core suite and typecheck**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS. A failure elsewhere means that test depended on the old 400-line threshold — report it rather than adjusting the threshold.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/rules/architecture/component-size.ts packages/core/test/architecture-rules.test.ts
git commit -m "fix(core): lower architecture/component-size threshold to 200 from measured data"
```

---

### Task 3: Documentation, changeset, and full verification

**Files:**

- Modify: `docs/src/content/docs/rules/architecture/prop-count.md`
- Modify: `docs/src/content/docs/ja/rules/architecture/prop-count.md`
- Modify: `docs/src/content/docs/rules/architecture/component-size.md`
- Modify: `docs/src/content/docs/ja/rules/architecture/component-size.md`
- Create: `.changeset/architecture-threshold-recalibration.md`

**Interfaces:**

- Consumes: `MAX_PROPS = 6` (Task 1) and `MAX_LOC = 200` (Task 2) — the doc pages and changeset must quote exactly these numbers.

- [ ] **Step 1: Update the English prop-count page**

In `docs/src/content/docs/rules/architecture/prop-count.md`, replace the "What it checks" paragraph:

```markdown
Flags a component that destructures more than 10 props from `$props()`. A rest element (`...rest`) or a non-destructured `$props()` is not counted.
```

with:

```markdown
Flags a component that destructures more than 6 props from `$props()`. A rest element (`...rest`) or a non-destructured `$props()` is not counted.

The threshold is measured, not guessed: 6 is the median of the per-repository 90th percentile of prop counts across 2,239 components in 7 real Svelte 5 codebases. In other words, a component with 7 or more props is wider than roughly 90% of the components in a typical Svelte project.
```

- [ ] **Step 2: Update the Japanese prop-count page**

In `docs/src/content/docs/ja/rules/architecture/prop-count.md`, replace the "チェック内容" paragraph:

```markdown
`$props()` から 10 個を超えるプロップを分割代入しているコンポーネントを検出します。レスト要素（`...rest`）や分割代入していない `$props()` はカウントしません。
```

with:

```markdown
`$props()` から 6 個を超えるプロップを分割代入しているコンポーネントを検出します。レスト要素（`...rest`）や分割代入していない `$props()` はカウントしません。

この閾値は実測に基づいています。実在する Svelte 5 のコードベース 7 件・2,239 コンポーネントを解析し、リポジトリごとの 90 パーセンタイルの中央値を採った値が 6 です。つまりプロップが 7 個以上のコンポーネントは、典型的な Svelte プロジェクトの上位 1 割程度に入る幅の広さ、ということになります。
```

- [ ] **Step 3: Update the English component-size page**

In `docs/src/content/docs/rules/architecture/component-size.md`, replace the "What it checks" paragraph:

```markdown
Flags a `.svelte` component longer than 400 lines (static/CLI analysis of `src/**/*.svelte`).
```

with:

```markdown
Flags a `.svelte` component longer than 200 lines (static/CLI analysis of `src/**/*.svelte`).

The threshold comes from the same measurement as `architecture/prop-count`: across 7 real Svelte 5 codebases the median per-repository 90th percentile is 124 lines and the 95th is 179. 200 sits deliberately above both, because length is a weaker signal than a wide prop surface — tables, forms, and generated markup are legitimately long.
```

- [ ] **Step 4: Update the Japanese component-size page**

In `docs/src/content/docs/ja/rules/architecture/component-size.md`, replace the "チェック内容" paragraph:

```markdown
400 行を超える `.svelte` コンポーネントを検出します（CLI による `src/**/*.svelte` の静的解析）。
```

with:

```markdown
200 行を超える `.svelte` コンポーネントを検出します（CLI による `src/**/*.svelte` の静的解析）。

閾値は `architecture/prop-count` と同じ実測に基づきます。実在する Svelte 5 のコードベース 7 件では、リポジトリごとの 90 パーセンタイルの中央値が 124 行、95 パーセンタイルが 179 行でした。200 行はそのどちらよりも意図的に緩めに設定しています。行数はプロップの多さに比べると弱いシグナルで、テーブルやフォーム、生成されたマークアップは正当に長くなるためです。
```

- [ ] **Step 5: Create the changeset**

Create `.changeset/architecture-threshold-recalibration.md`:

```markdown
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Recalibrate the Architecture thresholds against real Svelte code: `architecture/prop-count` now flags more than 6 props (was 10) and `architecture/component-size` flags components longer than 200 lines (was 400).

Both numbers were previously guesses. They are now derived by measuring 2,239 components across 7 real Svelte 5 codebases and taking the median of each repository's 90th percentile — the same benchmark-based method ReactSniffer uses for React. At the old values these rules almost never fired on a typical Svelte project.

Expect new `info` findings and a correspondingly lower Architecture score on existing projects; each `info` finding deducts 1 point. Turn a rule off in `svelte-vitals.config.mjs` (`rules: { 'architecture/prop-count': 'off' }`) if its default does not suit your codebase — per-rule thresholds are not configurable yet.
```

- [ ] **Step 6: Run the full verification suite**

Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm check:publish`
Expected: all five PASS. If `pnpm lint` reports formatting, run `pnpm format` and re-run `pnpm lint`. Any failure the changed files do not explain should be investigated and reported, not patched around.

- [ ] **Step 7: Check the new thresholds against this repository's own docs site**

The repo contains real Svelte components under `docs/`, so it is a free sanity check that the new numbers produce sensible output rather than a flood.

Write this to a scratch file (not into the repository) and run it with `node`:

```js
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseComponentFacts } from './packages/core/dist/index.js';

const skip = new Set(['node_modules', '.git', '.svelte-kit', 'dist', 'build']);
const walk = (d, out = []) => {
  for (const e of readdirSync(d)) {
    if (skip.has(e)) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.svelte')) out.push(p);
  }
  return out;
};

let total = 0;
let overProps = 0;
let overLoc = 0;
for (const f of walk('docs')) {
  total++;
  try {
    const c = parseComponentFacts(readFileSync(f, 'utf8'), f);
    if (c.propCount > 6) overProps++;
    if (c.loc > 200) overLoc++;
  } catch {
    // unparsable component — the rules skip these too
  }
}
console.log(`components: ${total} | over 6 props: ${overProps} | over 200 loc: ${overLoc}`);
```

`pnpm build` in Step 6 already produced the `dist` this imports.

Expected: counts that are small relative to the number of components, but not zero for both — zero everywhere would mean the new thresholds still never fire on real code, which is the problem this change exists to fix. Record the numbers in your report; this is a sanity signal, not a pass/fail gate.

- [ ] **Step 8: Commit**

```bash
git add docs/src/content/docs/rules/architecture .changeset/architecture-threshold-recalibration.md
git commit -m "docs: document the measured architecture thresholds and add a changeset"
```
