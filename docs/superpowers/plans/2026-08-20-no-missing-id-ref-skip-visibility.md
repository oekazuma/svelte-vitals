# no-missing-id-ref Skip Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `a11y/no-missing-id-ref`'s per-route skips visible — per-route causes with locations in the JSON report plus one CLI warning line — per `docs/superpowers/specs/2026-08-20-no-missing-id-ref-skip-visibility-design.md`.

**Architecture:** The three code sites that clear `fullyResolved` (source-mode collection in `packages/cli/src/providers/source/`) record a cause each instead of only flipping the boolean; `ResolvedA11y` carries them; the CLI assembles a rule-keyed `skipped` map into `JsonReport` (new optional field, the `examined` pattern) and pushes one line onto the existing `warnings` channel. Scores, findings, and summaries are untouched. Rendered mode (vite) never skips and is untouched.

**Tech Stack:** TypeScript, vitest, pnpm workspace. Work on branch `design/no-missing-id-ref-skip-visibility` (the spec is already committed there).

## Global Constraints

- **Core purity**: `packages/core` gets type/report changes only — no `node:` imports, no I/O (`packages/core/CLAUDE.md`).
- **No new dependencies** anywhere.
- **No new named export from `packages/core/src/index.ts`** — the `skipped` field's shape stays inline in `JsonReport` (spec: type-closed public surface).
- Conventional commits scoped by package (`feat(cli):`, `feat(core):`, `docs:`, `test:`).
- en/ja docs edited together, then `pnpm --filter docs run translate:stamp <en-file...>`.
- Format with `pnpm format` before each commit; verify with `pnpm build && pnpm typecheck && pnpm test && pnpm lint` at the end (test needs the build first — `pnpm test` runs it).
- Warning string, field names, and cause kinds are pinned by the spec — copy them exactly as written in the tasks below.

---

### Task 1: Collect skip causes in source-mode collection

**Files:**

- Modify: `packages/core/src/a11y.ts` (add `A11ySkipCause`, `ResolvedA11y.unresolvedCauses`)
- Modify: `packages/cli/src/providers/source/parse.ts` (replace `unknowableContent: boolean` with located `unknowable` array)
- Modify: `packages/cli/src/providers/source/routes.ts` (record causes at the three clearing sites, dedupe, emit)
- Test: `packages/cli/test/source-provider.test.ts`

**Interfaces:**

- Consumes: existing `collectRoutes` / `ParsedA11y` / `ResolvedA11y`.
- Produces: `A11ySkipCause` (exported from `packages/core/src/a11y.ts`, reaches the CLI via `@svelte-vitals/core/internal` like `ResolvedA11y` does):

  ```ts
  export interface A11ySkipCause {
    kind: 'component' | 'spread' | 'html' | 'dynamic-id';
    file: string;
    line: number;
    /** for kind 'component': the unresolvable component's name as written */
    detail?: string;
  }
  ```

  and `ResolvedA11y.unresolvedCauses?: A11ySkipCause[]` — present exactly when `fullyResolved` is false, deduped by `(kind, file, detail)` keeping the first occurrence's line.

- [ ] **Step 1: Write the failing tests**

In `packages/cli/test/source-provider.test.ts`, inside `describe('collectRoutes a11y composition')`, extend the four existing world-opening tests and add two new ones. The `a11yOf` helper already exists at the top of the describe block.

Extend `'opens the world for an unresolvable component'` (currently asserts only `fullyResolved`):

```ts
it('opens the world for an unresolvable component', async () => {
  const a11y = await a11yOf({
    'src/routes/+page.svelte': `<script>import Fancy from 'fancy-ui';</script><Fancy />`
  });
  expect(a11y.fullyResolved).toBe(false);
  expect(a11y.unresolvedCauses).toEqual([
    { kind: 'component', detail: 'Fancy', file: 'src/routes/+page.svelte', line: 1 }
  ]);
});
```

Extend `'opens the world for a dynamic id, which is no candidate'`:

```ts
expect(a11y.unresolvedCauses).toEqual([{ kind: 'dynamic-id', file: 'src/routes/+page.svelte', line: 1 }]);
```

Extend `'opens the world for {@html} content'`:

```ts
expect(a11y.unresolvedCauses).toEqual([{ kind: 'html', file: 'src/routes/+page.svelte', line: 1 }]);
```

Extend the fully-resolved test that asserts `fullyResolved` is `true` (the one with `<label for="x">` in the layout, around line 511):

```ts
expect(a11y.unresolvedCauses).toBeUndefined();
```

Add two new tests at the end of the describe block:

```ts
it('records a spread attribute as a located cause', async () => {
  const a11y = await a11yOf({
    'src/routes/+page.svelte': `<h1>t</h1>\n<div {...rest}>spread</div>`
  });
  expect(a11y.fullyResolved).toBe(false);
  expect(a11y.unresolvedCauses).toEqual([{ kind: 'spread', file: 'src/routes/+page.svelte', line: 2 }]);
});

it('dedupes causes by (kind, file, detail), keeping the first line', async () => {
  const a11y = await a11yOf({
    'src/routes/+page.svelte': `<script>import Fancy from 'fancy-ui';</script>\n<Fancy />\n<Fancy />\n<div {...a}>x</div>\n<div {...b}>y</div>`
  });
  expect(a11y.unresolvedCauses).toHaveLength(2);
  expect(a11y.unresolvedCauses).toEqual(
    expect.arrayContaining([
      { kind: 'component', detail: 'Fancy', file: 'src/routes/+page.svelte', line: 2 },
      { kind: 'spread', file: 'src/routes/+page.svelte', line: 4 }
    ])
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/source-provider.test.ts`
Expected: FAIL — `unresolvedCauses` is `undefined` in every extended/new test.

- [ ] **Step 3: Implement**

**`packages/core/src/a11y.ts`** — add above `ResolvedA11y`:

```ts
/** One reason a route's closed world failed to hold, with the first offending location. */
export interface A11ySkipCause {
  kind: 'component' | 'spread' | 'html' | 'dynamic-id';
  file: string;
  line: number;
  /** for kind 'component': the unresolvable component's name as written */
  detail?: string;
}
```

and inside `ResolvedA11y`, directly after `fullyResolved`:

```ts
/** Why `fullyResolved` is false — deduped by (kind, file, detail), first occurrence's line kept. Present exactly when `fullyResolved` is false. */
unresolvedCauses?: A11ySkipCause[];
```

(`internal.ts` re-exports `a11y.js` already — verify with `grep -n "a11y" packages/core/src/internal.ts`; if the export is type-selective, add `A11ySkipCause` there. Do **not** touch `index.ts`.)

**`packages/cli/src/providers/source/parse.ts`** — in `ParsedA11y`, replace

```ts
/** file contains {@html} or a spread attribute — poisons the closed world for no-missing-id-ref */
unknowableContent: boolean;
```

with

```ts
export interface ParsedA11y {
  // (other fields unchanged)
  /** {@html} tags and spread attributes, located — each poisons the closed world for no-missing-id-ref */
  unknowable: { kind: 'spread' | 'html'; line: number }[];
}
```

In `collectA11y`, replace `let unknowableContent = false;` with `const unknowable: ParsedA11y['unknowable'] = [];`, and rewrite `noteSpread` to record the spread attribute's own location:

```ts
const noteSpread = (node: WalkNode): void => {
  const attributes = (node as { attributes?: unknown }).attributes;
  if (!Array.isArray(attributes)) return;
  const spread = attributes.find((a) => (a as { type?: string }).type === 'SpreadAttribute');
  if (spread) unknowable.push({ kind: 'spread', line: lineOf(source, (spread as { start: number }).start) });
};
```

In the `case 'HtmlTag':` branch, replace `unknowableContent = true;` with `unknowable.push({ kind: 'html', line: lineOf(source, node.start) });` (keep `elementsUnknowable = true;`). Update the `return` at the bottom of `collectA11y` to emit `unknowable` instead of `unknowableContent`.

**`packages/cli/src/providers/source/routes.ts`** — import `A11ySkipCause` from the same module the file imports `ResolvedA11y` from. In `ComposeState`, add `causes: A11ySkipCause[];` after `fullyResolved`. In `composeA11y`, replace

```ts
if (parsed.a11y.unknowableContent) state.fullyResolved = false;
```

with

```ts
if (parsed.a11y.unknowable.length > 0) {
  state.fullyResolved = false;
  for (const u of parsed.a11y.unknowable) state.causes.push({ ...u, file: fileRel });
}
```

In the unresolved-component branch (the `if (!childRel || depth <= 0 || …)` block), add after `state.fullyResolved = false;`:

```ts
state.causes.push({ kind: 'component', detail: node.key, file: fileRel, line: node.line });
```

In `resolveRoute`: initialize the state with `causes: []`; replace the dynamic-id line

```ts
if (idNodes.some((n) => n.key === '')) a11yCtx.state.fullyResolved = false;
```

with

```ts
for (const n of idNodes) {
  if (n.key !== '') continue;
  a11yCtx.state.fullyResolved = false;
  a11yCtx.state.causes.push({ kind: 'dynamic-id', file: n.file, line: n.line });
}
```

Add a module-level helper near `groupSpan`:

```ts
/** Route-level dedupe: one cause per (kind, file, detail), first occurrence wins. */
function dedupeCauses(causes: A11ySkipCause[]): A11ySkipCause[] {
  const seen = new Map<string, A11ySkipCause>();
  for (const c of causes) {
    const key = `${c.kind}�${c.file}�${c.detail ?? ''}`;
    if (!seen.has(key)) seen.set(key, c);
  }
  return [...seen.values()];
}
```

and in the returned `a11y` object, after `fullyResolved`:

```ts
...(a11yCtx.state.causes.length > 0 ? { unresolvedCauses: dedupeCauses(a11yCtx.state.causes) } : {}),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core run build && pnpm --filter svelte-vitals exec vitest run test/source-provider.test.ts`
Expected: PASS (build core first — the cli imports core's built dist types).

Also run the full cli + core suites to catch fallout from the `ParsedA11y` shape change:
`pnpm --filter @svelte-vitals/core exec vitest run && pnpm --filter svelte-vitals exec vitest run`
Expected: PASS. Any failure will be a leftover `unknowableContent` reference — fix the reference, don't reshape the new API.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/a11y.ts packages/cli/src/providers/source/parse.ts packages/cli/src/providers/source/routes.ts packages/cli/test/source-provider.test.ts
git commit -m "feat(cli): record why a route's closed world failed for a11y/no-missing-id-ref"
```

---

### Task 2: `skipped` field on `JsonReport`

**Files:**

- Modify: `packages/core/src/reporter/json.ts` (`JsonReport`, `buildJsonReport`, `formatJsonReport`)
- Test: `packages/core/test/json-report.test.ts`

**Interfaces:**

- Consumes: nothing from Task 1 (the shape is structural, not `A11ySkipCause`).
- Produces: `JsonReport['skipped']` and a sixth optional parameter on both `buildJsonReport(results, config, meta, ruleIds?, examined?, skipped?)` and `formatJsonReport(...)` with the same name and type. Task 3 calls `formatJsonReport` with it.

- [ ] **Step 1: Write the failing test**

In `packages/core/test/json-report.test.ts` (a `results` array and `config` already exist at module top), add:

```ts
describe('skipped routes map', () => {
  const skipped = {
    'a11y/no-missing-id-ref': [
      {
        route: '/x',
        refs: 2,
        causes: [{ kind: 'spread', file: 'src/routes/x/+page.svelte', line: 3 }]
      }
    ]
  };

  it('is included verbatim when entries exist and omitted otherwise', () => {
    const report = buildJsonReport(results, config, { version: '0.0.0' }, undefined, undefined, skipped);
    expect(report.skipped).toEqual(skipped);
    expect(buildJsonReport(results, config, { version: '0.0.0' }).skipped).toBeUndefined();
    expect(buildJsonReport(results, config, { version: '0.0.0' }, undefined, undefined, {}).skipped).toBeUndefined();
  });

  it('round-trips through formatJsonReport', () => {
    const parsed = JSON.parse(formatJsonReport(results, config, { version: '0.0.0' }, undefined, undefined, skipped));
    expect(parsed.skipped).toEqual(skipped);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/json-report.test.ts`
Expected: FAIL — TypeScript rejects the sixth argument / `skipped` is undefined.

- [ ] **Step 3: Implement**

In `JsonReport`, after `examined?`:

```ts
/**
 * Routes a closed-world rule skipped, keyed by rule id. Like `examined`, this describes the
 * analysis rather than the report: `--diff`, `--baseline` and suppressions do not narrow it.
 * `refs` is the route's literal id-reference count — a skipped route with `refs: 0` would
 * produce nothing even if unlocked. Only source-mode analysis populates it; absent when no
 * analyzed route was skipped.
 */
skipped?: Record<
  string,
  Array<{ route: string; refs: number; causes: Array<{ kind: string; file: string; line: number; detail?: string }> }>
>;
```

Add the parameter `skipped?: JsonReport['skipped']` as the sixth parameter of `buildJsonReport`, and spread it into the returned object exactly like `examined`:

```ts
...(skipped && Object.keys(skipped).length > 0 ? { skipped } : {})
```

Give `formatJsonReport` the same sixth parameter and pass it through to `buildJsonReport`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/json-report.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/reporter/json.ts packages/core/test/json-report.test.ts
git commit -m "feat(core): optional skipped-routes map on JsonReport"
```

---

### Task 3: CLI assembly — `AnalyzeResult.skipped` and the warning line

**Files:**

- Create: `packages/cli/src/a11y-skips.ts`
- Modify: `packages/cli/src/index.ts` (`AnalyzeResult`, `analyzeProject`, the `formatJsonReport` call in `run()`)
- Test: `packages/cli/test/analyze-project.test.ts`

**Interfaces:**

- Consumes: `ResolvedA11y` (with Task 1's `unresolvedCauses`) and `JsonReport['skipped']` (Task 2), both from `@svelte-vitals/core/internal`.
- Produces:

  ```ts
  // packages/cli/src/a11y-skips.ts
  export type SkippedRouteEntry = NonNullable<JsonReport['skipped']>[string][number];
  export function buildIdRefSkips(a11y: readonly ResolvedA11y[]): SkippedRouteEntry[];
  export function idRefSkipWarning(entries: readonly SkippedRouteEntry[], analyzedRoutes: number): string;
  ```

  and `AnalyzeResult.skipped?: JsonReport['skipped']`.

- [ ] **Step 1: Write the failing tests**

In `packages/cli/test/analyze-project.test.ts` add a describe block. `fixtureDir` (`fixtures/basic-project`) already exists; its `/smt-spread` route imports `MetaTags` from the package `svelte-meta-tags` (kind `component`) and spreads props onto it (kind `spread`), so it is already a skipped route.

```ts
describe('no-missing-id-ref skip visibility', () => {
  it('surfaces skipped routes with refs, causes and one warning line', async () => {
    const { skipped, warnings } = await analyzeProject({ cwd: fixtureDir });
    const entries = skipped!['a11y/no-missing-id-ref']!;
    const smt = entries.find((e) => e.route === '/smt-spread')!;
    expect(smt.refs).toBeGreaterThanOrEqual(0);
    expect(smt.causes.map((c) => c.kind).sort()).toEqual(['component', 'spread']);
    expect(smt.causes.find((c) => c.kind === 'component')!.detail).toBe('MetaTags');
    expect(smt.causes.every((c) => c.file === 'src/routes/smt-spread/+page.svelte' && c.line > 0)).toBe(true);
    const skipWarnings = warnings.filter((w) => w.startsWith('a11y/no-missing-id-ref skipped'));
    expect(skipWarnings).toHaveLength(1);
    expect(skipWarnings[0]).toMatch(
      /^a11y\/no-missing-id-ref skipped \d+ of \d+ analyzed route\(s\) \(.* — per-route detail in the JSON report's "skipped"\)\.$/
    );
  });

  it('is absent, with no warning, when the rule is deselected', async () => {
    const { skipped, warnings } = await analyzeProject({ cwd: fixtureDir, ignoreRules: ['a11y/no-missing-id-ref'] });
    expect(skipped).toBeUndefined();
    expect(warnings.some((w) => w.startsWith('a11y/no-missing-id-ref skipped'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/analyze-project.test.ts`
Expected: the two new tests FAIL (`skipped` does not exist).

- [ ] **Step 3: Implement**

Create `packages/cli/src/a11y-skips.ts`:

```ts
import type { JsonReport, ResolvedA11y } from '@svelte-vitals/core/internal';

export const ID_REF_RULE = 'a11y/no-missing-id-ref';

export type SkippedRouteEntry = NonNullable<JsonReport['skipped']>[string][number];

/** One entry per analyzed route whose closed world failed; sorted for stable report output. */
export function buildIdRefSkips(a11y: readonly ResolvedA11y[]): SkippedRouteEntry[] {
  return a11y
    .filter((r) => !r.fullyResolved)
    .map((r) => ({ route: r.route, refs: r.idRefs.length, causes: r.unresolvedCauses ?? [] }))
    .sort((a, b) => a.route.localeCompare(b.route));
}

// Fixed order; a kind no skipped route carries is omitted. Counts are routes-carrying-the-kind,
// so they overlap and do not sum to the skipped total (spec: "Reporting").
const KIND_LABELS: ReadonlyArray<readonly [string, string]> = [
  ['component', 'unresolved component'],
  ['spread', 'spread'],
  ['html', '{@html}'],
  ['dynamic-id', 'dynamic id']
];

export function idRefSkipWarning(entries: readonly SkippedRouteEntry[], analyzedRoutes: number): string {
  const parts: string[] = [];
  for (const [kind, label] of KIND_LABELS) {
    const n = entries.filter((e) => e.causes.some((c) => c.kind === kind)).length;
    if (n > 0) parts.push(`${label} ${n}`);
  }
  return (
    `${ID_REF_RULE} skipped ${entries.length} of ${analyzedRoutes} analyzed route(s) ` +
    `(${parts.join(', ')} — per-route detail in the JSON report's "skipped").`
  );
}
```

In `packages/cli/src/index.ts`:

- Import `buildIdRefSkips, idRefSkipWarning, ID_REF_RULE` from `./a11y-skips.js`.
- In `AnalyzeResult`, after `examined`:

  ```ts
  /** Routes a closed-world rule skipped, keyed by rule id — the analysis-side companion to `examined`; unfiltered by `--diff`/`--baseline`/suppressions. Absent when no analyzed route was skipped or the rule was not selected. */
  skipped?: JsonReport['skipped'];
  ```

  (`JsonReport` is importable from `@svelte-vitals/core/internal`; add it to an existing type import.)

- In `analyzeProject`, after `const rules = …` (the category-narrowed selection):

  ```ts
  const idRefSkips = rules.some((r) => r.id === ID_REF_RULE) ? buildIdRefSkips(a11y) : [];
  if (idRefSkips.length > 0) warnings.push(idRefSkipWarning(idRefSkips, a11y.length));
  ```

  and in the returned object:

  ```ts
  ...(idRefSkips.length > 0 ? { skipped: { [ID_REF_RULE]: idRefSkips } } : {}),
  ```

- In `run()`, pass it to the JSON reporter:

  ```ts
  log(formatJsonReport(results, config, { version }, analysis.ruleIds, analysis.examined, analysis.skipped));
  ```

- [ ] **Step 4: Run the cli suite; repair assertions the new warning legitimately breaks**

Run: `pnpm --filter svelte-vitals exec vitest run`

The two new tests must PASS. Expect collateral failures in tests that pinned `warnings` as empty — `analyze-project.test.ts:51` asserts `expect(warnings).toEqual([])` against `basic-project`, which now carries the skip warning; lines ~365–378 do the same against other fixtures, and `run.test.ts`/`cli-contract.test.ts` may snapshot stderr. For each failure: confirm the only delta is the one `a11y/no-missing-id-ref skipped …` line, then update the assertion to expect exactly that line, e.g.

```ts
expect(warnings).toEqual([expect.stringMatching(/^a11y\/no-missing-id-ref skipped /)]);
```

(for fixtures with no skipped route, `toEqual([])` stays). Any other delta is a bug in Tasks 1–3 — stop and fix it, don't loosen the assertion.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/a11y-skips.ts packages/cli/src/index.ts packages/cli/test/analyze-project.test.ts
git add -u packages/cli/test
git commit -m "feat(cli): surface a11y/no-missing-id-ref skipped routes in the JSON report and warn"
```

---

### Task 4: Kitchen-sink sample + e2e guard

**Files:**

- Create: `examples/kitchen-sink/src/routes/gallery/a11y/skipped/+page.svelte`
- Modify: `examples/kitchen-sink/test/e2e-static.test.ts`
- Modify: `examples/kitchen-sink/test/e2e-build.test.ts` (rendered mode never skips)
- Modify: `examples/kitchen-sink/expected-findings.rendered.json` (rendered count +1 for `a11y/no-missing-id-ref`)

**Interfaces:**

- Consumes: the built CLI (`packages/cli/dist/bin.js`) with Tasks 1–3; the report's `skipped` field and the stderr warning.
- Produces: nothing downstream.

- [ ] **Step 1: Create the sample route**

`examples/kitchen-sink/src/routes/gallery/a11y/skipped/+page.svelte` — head is complete (clean-canary pattern) so the route adds no SEO findings; the spread and dynamic id clear the closed world; the dangling `for` is the defect static mode must _not_ silently miss reporting about:

```svelte
<script lang="ts">
  const attrs = { 'data-origin': 'spread' };
  const dynId = 'runtime-id';
</script>

<svelte:head>
  <title>Gallery — a11y skip visibility · svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A route whose closed world fails: static analysis skips a11y/no-missing-id-ref here and says so in the report."
  />
  <link rel="canonical" href="https://example.com/gallery/a11y/skipped" />
  <meta property="og:title" content="Gallery — a11y skip visibility · svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A route whose closed world fails: static analysis skips a11y/no-missing-id-ref here and says so in the report."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/gallery/a11y/skipped" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<h1>Gallery — a11y skip visibility</h1>

<!-- a11y/no-missing-id-ref (static mode): the spread and the dynamic id below clear this route's
     closed world, so the rule skips it — the skip, with both causes, must appear in the JSON
     report's `skipped`. Rendered mode has no such gate: the prerendered document is closed, so
     this dangling `for` is a rendered finding (expected-findings.rendered.json). -->
<label for="phantom-input">Phantom label</label>
<div {...attrs}>Spread poisons the closed world.</div>
<span id={dynId}>So does a dynamic id.</span>
```

- [ ] **Step 2: Write the failing e2e assertions**

In `examples/kitchen-sink/test/e2e-static.test.ts`:

- Extend the local `JsonReport` interface:

  ```ts
  skipped?: Record<
    string,
    Array<{ route: string; refs: number; causes: Array<{ kind: string; file: string; line: number; detail?: string }> }>
  >;
  ```

- Capture stderr: add `let stderr = '';` next to `let exitCode = 0;`, and in the `beforeAll` catch block add `stderr = (e as { stderr?: string }).stderr ?? '';` (the kitchen sink always exits 1 on critical findings, so the run lands in the catch).
- Add the test:

  ```ts
  it('reports the skipped route with its causes and warns on stderr', () => {
    const entries = report.skipped!['a11y/no-missing-id-ref']!;
    const entry = entries.find((e) => e.route === '/gallery/a11y/skipped')!;
    expect(entry.refs).toBeGreaterThanOrEqual(1);
    expect(entry.causes.map((c) => c.kind).sort()).toEqual(['dynamic-id', 'spread']);
    expect(entry.causes.every((c) => c.file === 'src/routes/gallery/a11y/skipped/+page.svelte' && c.line > 0)).toBe(
      true
    );
    expect(stderr).toContain('a11y/no-missing-id-ref skipped');
  });
  ```

- [ ] **Step 3: Build, run static e2e, verify**

Run: `pnpm build && pnpm --filter kitchen-sink exec vitest run test/e2e-static.test.ts`

Expected: the new test PASSES and **every existing count assertion still passes** — the head is complete and the route adds no landmark/id/heading defect, so no `expected-findings.json` entry should move. If a count does move, the finding is on the new route: fix the route content to stop triggering that rule (do not bump `expected-findings.json`), except `a11y/no-missing-id-ref` static findings which must stay at 1 (the skip emits nothing).

- [ ] **Step 4: Update the rendered expectation, assert rendered mode never skips, run the build e2e**

In `examples/kitchen-sink/expected-findings.rendered.json`, increment `a11y/no-missing-id-ref` by 1 (the prerendered `/gallery/a11y/skipped` document has `<label for="phantom-input">` with no such id — rendered mode runs the rule everywhere).

In `examples/kitchen-sink/test/e2e-build.test.ts`, add the same optional `skipped?` field to its local `JsonReport` interface as in Step 2, and add the spec's "absent in rendered mode" guard as a test:

```ts
it('never reports skipped routes: the prerendered document is its own closed world', () => {
  expect(report.skipped).toBeUndefined();
});
```

Run: `pnpm --filter kitchen-sink exec vitest run test/e2e-build.test.ts`
Expected: PASS. If another rendered count moved, the cause is the new route's rendered output — adjust the route, not unrelated expectations.

- [ ] **Step 5: Commit**

```bash
git add examples/kitchen-sink/src/routes/gallery/a11y/skipped/+page.svelte examples/kitchen-sink/test/e2e-static.test.ts examples/kitchen-sink/test/e2e-build.test.ts examples/kitchen-sink/expected-findings.rendered.json
git commit -m "test(cli): kitchen-sink guard for no-missing-id-ref skip visibility"
```

---

### Task 5: Docs, changeset, full verification

**Files:**

- Modify: `docs/src/content/docs/rules/a11y/no-missing-id-ref.md` and `docs/src/content/docs/ja/rules/a11y/no-missing-id-ref.md`
- Modify: `docs/src/content/docs/guides/(reporting)/reporters.md` and `docs/src/content/docs/ja/guides/(reporting)/reporters.md`
- Create: `.changeset/no-missing-id-ref-skip-visibility.md`

**Interfaces:** none — prose only.

- [ ] **Step 1: Rule page (en, then ja)**

In `no-missing-id-ref.md` (en), directly after the paragraph ending "so skipping the whole route beats guessing.", add:

```markdown
A skip is no longer silent. When at least one analyzed route is skipped, the CLI prints one
warning naming the skipped/analyzed ratio and the causes, and the JSON report carries a
top-level `skipped["a11y/no-missing-id-ref"]` array: one entry per skipped route with the
route's literal id-reference count (`refs`) and each cause — `component` (with the
component's name), `spread`, `html` (`{@html}`), or `dynamic-id` — located at the first
file and line that cleared the gate. A report where the rule never ran is therefore
distinguishable from one where it passed everywhere, and each entry says exactly what to
change for the rule to run on that route.
```

Mirror the same content in Japanese in the ja page at the same position.

- [ ] **Step 2: Reporters guide (en, then ja)**

In `reporters.md` (en), after the `examined` explanation paragraphs (around line 142), add a `skipped` section:

```markdown
`skipped` is a second analysis-side map, keyed by rule id. Today only
`a11y/no-missing-id-ref` uses it: the rule needs a fully resolved route composition, and a
route that fails that bar is skipped without a result. Each entry lists the skipped route,
its literal id-reference count (`refs` — a route with `0` would produce nothing even if it
ran), and the causes that cleared the gate, each with `kind` (`component`, `spread`, `html`,
or `dynamic-id`), the first offending `file` and `line`, and for components the name as
written (`detail`). Like `examined`, it describes the analysis rather than the report —
`--diff`, `--baseline` and suppressions do not narrow it — and it is omitted when no
analyzed route was skipped.
```

Add the matching JSON fragment to the sample report block in the same file:

```json
"skipped": {
  "a11y/no-missing-id-ref": [
    {
      "route": "/checkout",
      "refs": 2,
      "causes": [{ "kind": "component", "detail": "Textbox", "file": "src/routes/checkout/+page.svelte", "line": 12 }]
    }
  ]
}
```

Mirror both in the ja page, then stamp:

```bash
pnpm --filter docs run translate:stamp "src/content/docs/rules/a11y/no-missing-id-ref.md" "src/content/docs/guides/(reporting)/reporters.md"
```

(If the stamp script expects different path forms, follow its usage output — the two en files above are the pages changed.)

- [ ] **Step 3: Record the field in the public-surface enumeration**

`docs/superpowers/specs/2026-08-16-v1-public-surface.md` enumerates `JsonReport`'s frozen fields (`…, inventories, examined?`) and is maintained on additions (see its "Added 2026-08-17" precedent). Append `skipped?` to that enumeration with a dated one-liner noting it arrived via the skip-visibility design.

- [ ] **Step 4: Changeset**

Create `.changeset/no-missing-id-ref-skip-visibility.md`:

```markdown
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

`a11y/no-missing-id-ref` no longer skips silently. The JSON report gains an optional
top-level `skipped` map (rule id → skipped routes, each with its literal id-reference count
and the located causes — unresolved component, spread, `{@html}`, or dynamic id — that
cleared the route's closed world), and the CLI prints one warning line with the
skipped/analyzed ratio whenever the rule is selected and at least one analyzed route was
skipped. Scores and findings are unchanged: a skipped route still produces no result.
```

- [ ] **Step 5: Full verification**

```bash
pnpm format && pnpm build && pnpm typecheck && pnpm test && pnpm lint
```

Expected: all green, including `io-budget.test.ts` (this change adds no `Runtime` calls) and the docs job's translate check locally if available (`pnpm --filter docs run translate:check` if that script exists — otherwise the stamp in Step 2 is what CI checks).

- [ ] **Step 6: Commit**

```bash
git add docs/src/content/docs docs/blume.translations.json docs/superpowers/specs/2026-08-16-v1-public-surface.md .changeset/no-missing-id-ref-skip-visibility.md
git commit -m "docs: document no-missing-id-ref skip surfacing"
```

---

## After the plan

The measurement run (spec section "Measurement") is deliberately **not** a task here: it needs the merged/built CLI and produces a `*-widening-measured.md` spec, its own piece of work. Branch finish: use superpowers:finishing-a-development-branch — this repo merges via PR, never a direct push to `main`.
