# Shell-id Duplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect route ids colliding with `src/app.html` shell ids in source mode, per `docs/superpowers/specs/2026-08-21-shell-id-duplication-design.md` (roadmap C-7).

**Architecture:** `detectAppHtmlIds` gains line numbers (newline-preserving stripping); `resolveRoute` prepends a never-penalized `src/app.html` representative to folded `ids` entries that collide with a shell id; `surplusRule`'s message callback gains the entry's first representative so `a11y/id-duplication` can name the shell. Every finding stays located in a route file — `findingKey` never sees an out-of-route location.

**Tech Stack:** TypeScript, vitest, pnpm workspace. Work on branch `design/shell-id-duplication` (the spec is committed there).

## Global Constraints

- Core purity: no `node:` imports, no I/O in `packages/core`. Do NOT touch `packages/core/src/index.ts`. No new dependencies.
- `Project` is internal — the `appHtmlIds` type change is free, but every consumer and test must move in the same commit as the type.
- The shell representative is ALWAYS first (explicit prepend after `representatives()` — never sorted in), and is only added for ids already present in the **folded** map.
- The merge iterates the folded map's own keys against a `Set`/`Map` of shell ids — never index the record by shell id (`id="constructor"` would read `Object.prototype`).
- No finding or PASS may ever carry `location: 'src/app.html'`.
- en/ja docs edited together, then `pnpm --filter docs run translate:stamp <en-file...>` (no `--` separator).
- Run `pnpm format` before each commit; conventional commits scoped by package. Full suite green at the end of every task.

---

### Task 1: shell ids gain line numbers (plumbing only)

**Files:**

- Modify: `packages/core/src/types.ts` (the `Project.appHtmlIds` field, around line 96)
- Modify: `packages/cli/src/providers/source/project.ts` (`detectAppHtmlIds`)
- Modify: `packages/cli/src/providers/source/routes.ts` (`collectRoutes`/`resolveRoute` parameter type; `idCandidates` maps to `.id`)
- Test: `packages/cli/test/project-facts.test.ts`, `packages/cli/test/source-provider.test.ts` (helper signature + existing assertions)

**Interfaces:**

- Consumes: `lineOf(source, offset)` — exported from core (`packages/core/src/svelte-ast.ts`); import it in `project.ts` from the same specifier `parse.ts` uses for `lineOf` (`@svelte-vitals/core/internal`).
- Produces (Task 2 relies on these):

  ```ts
  // packages/core/src/types.ts, on Project:
  /** Literal ids in src/app.html with the line each first appears on — shell content present on every rendered route. Absent when the file wasn't read. */
  appHtmlIds?: { id: string; line: number }[];
  ```

  and `collectRoutes(..., appHtmlIds?: readonly { id: string; line: number }[], ...)` threaded to `resolveRoute` unchanged in meaning: this task keeps `idCandidates` semantics identical (`.map((s) => s.id)`).

- [ ] **Step 1: Write the failing tests**

In `packages/cli/test/project-facts.test.ts`, update the three `appHtmlIds` assertions (lines ~64, ~94, ~99) from `['app', 'side']`/`['app']` to the `{ id, line }` shape — read each test's fixture HTML in the file and compute the real line numbers by hand, e.g. `toEqual([{ id: 'app', line: 8 }, { id: 'side', line: 9 }])` (the numbers must match the fixture, not be guessed). Add one new test pinning the newline-preserving strip:

```ts
it('reports the line of a shell id even below a multi-line comment', async () => {
  const rt = createMemoryRuntime({
    'src/app.html': `<html>\n<body>\n<!-- a\nmulti\nline\ncomment -->\n<div id="after"></div>\n</body>\n</html>`
  });
  expect((await collectProjectFacts(rt, '')).appHtmlIds).toEqual([{ id: 'after', line: 7 }]);
});
```

In `packages/cli/test/source-provider.test.ts`, change the `a11yOf` helper's parameter (line ~400) from `appHtmlIds?: string[]` to `appHtmlIds?: { id: string; line: number }[]`, and update its two call sites that pass `['app']` to `[{ id: 'app', line: 1 }]` (grep `['app']` in the file — the `tagsOf` helper passes `appHtmlBodyTags`, which is unrelated and stays `string[]`). The `idCandidates` assertions (`['x', 'app']` etc.) must stay green unchanged — that is the "plumbing only" pin.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/project-facts.test.ts test/source-provider.test.ts`
Expected: FAIL — type errors / shape mismatches.

- [ ] **Step 3: Implement**

`packages/core/src/types.ts` — change the field and its JSDoc per the Interfaces block.

`packages/cli/src/providers/source/project.ts` — rewrite `detectAppHtmlIds`:

```ts
function detectAppHtmlIds(html: string): { id: string; line: number }[] {
  // Newline-preserving strip: offsets on the stripped string must still yield correct
  // lines for ids below multi-line comments/scripts/styles.
  const keepNewlines = (m: string) => m.replace(/[^\n]/g, '');
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, keepNewlines)
    .replace(/<script[\s\S]*?<\/script\s*>/gi, keepNewlines)
    .replace(/<style[\s\S]*?<\/style\s*>/gi, keepNewlines);
  // The unquoted alternative rejects a leading '{' so templating placeholders (id={x}) stay out.
  const found = markup.matchAll(/(?<![\w-])id\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>{][^\s"'>]*))/gi);
  const out = new Map<string, number>();
  for (const m of found) {
    const id = m[1] ?? m[2] ?? m[3] ?? '';
    if (id && !out.has(id)) out.set(id, lineOf(markup, m.index));
  }
  return [...out].map(([id, line]) => ({ id, line }));
}
```

(Add `lineOf` to the existing `@svelte-vitals/core/internal` import in this file.)

`packages/cli/src/providers/source/routes.ts` — change the `appHtmlIds` parameter types on `collectRoutes` and `resolveRoute` to `readonly { id: string; line: number }[] | undefined`, and in `resolveRoute`'s returned `a11y` object change

```ts
idCandidates: [...new Set([...literalIds.map((n) => n.key), ...(appHtmlIds ?? [])])],
```

to

```ts
idCandidates: [...new Set([...literalIds.map((n) => n.key), ...(appHtmlIds ?? []).map((s) => s.id)])],
```

- [ ] **Step 4: Run the suites**

Run: `pnpm --filter @svelte-vitals/core run build && pnpm --filter svelte-vitals exec vitest run && pnpm -r typecheck`
Expected: PASS everywhere — behavior is unchanged, only the carrier type moved. Any other failure is a missed consumer; fix the consumer, not the type.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/types.ts packages/cli/src/providers/source/project.ts packages/cli/src/providers/source/routes.ts packages/cli/test/project-facts.test.ts packages/cli/test/source-provider.test.ts
git commit -m "feat(cli): shell ids carry their app.html line"
```

---

### Task 2: merge on collision + shell-naming message

**Files:**

- Modify: `packages/cli/src/providers/source/routes.ts` (`resolveRoute` — the merge)
- Modify: `packages/core/src/rules/a11y/route-rule.ts` (`surplusRule` message signature)
- Modify: `packages/core/src/rules/a11y/id-duplication.ts` (shell-naming message)
- Test: `packages/cli/test/source-provider.test.ts`, `packages/core/test/a11y-route-rules.test.ts`

**Interfaces:**

- Consumes: Task 1's `{ id, line }[]` shell ids in `resolveRoute`.
- Produces: `surplusRule`'s `message` callback becomes
  `message: (key: string, i: number, n: number, first: A11yOccurrenceInfo) => string`
  (existing callers may ignore the fourth argument), and `route.ids` entries whose id
  collides with a shell id carry `{ file: 'src/app.html', line }` as their FIRST
  representative.

- [ ] **Step 1: Write the failing tests**

In `packages/cli/test/source-provider.test.ts`, inside the `collectRoutes a11y composition` describe (the `a11yOf` helper takes `{ id, line }[]` after Task 1):

```ts
it('prepends the shell representative for a colliding id, first and with its line', async () => {
  const a11y = await a11yOf({ 'src/routes/+page.svelte': `<div id="shell-root"></div>` }, [
    { id: 'shell-root', line: 8 }
  ]);
  expect(a11y.ids['shell-root']).toEqual([
    { file: 'src/app.html', line: 8 },
    { file: 'src/routes/+page.svelte', line: 1 }
  ]);
});

it('a shell id with no route collision never enters the ids map', async () => {
  const a11y = await a11yOf({ 'src/routes/+page.svelte': `<div id="own"></div>` }, [{ id: 'lonely', line: 3 }]);
  expect(a11y.ids['lonely']).toBeUndefined();
  expect(a11y.idCandidates).toContain('lonely');
});

it('an each-body-only route id does not collide with the shell', async () => {
  const a11y = await a11yOf({ 'src/routes/+page.svelte': `{#each items as x}<li id="shell-root"></li>{/each}` }, [
    { id: 'shell-root', line: 8 }
  ]);
  expect(a11y.ids['shell-root']).toBeUndefined();
});
```

In `packages/core/test/a11y-route-rules.test.ts`, in the `a11y/id-duplication` describe (helpers `ra`/`ctxA11y`/`fails` exist):

```ts
it('names the shell when the first representative is src/app.html', async () => {
  const rs = await a11yIdDuplication.check(
    ctxA11y([
      ra({
        ids: {
          'shell-root': [
            { file: 'src/app.html', line: 8 },
            { file: 'src/routes/+page.svelte', line: 4 }
          ]
        }
      })
    ])
  );
  const f = fails(rs);
  expect(f).toHaveLength(1);
  expect(f[0]).toMatchObject({
    location: 'src/routes/+page.svelte',
    line: 4,
    message: 'Duplicate id "shell-root" — also defined by the src/app.html shell (line 8)'
  });
});

it('keeps the plain message for route-internal duplicates', async () => {
  const rs = await a11yIdDuplication.check(
    ctxA11y([
      ra({
        ids: {
          x: [
            { file: 'a.svelte', line: 1 },
            { file: 'b.svelte', line: 2 }
          ]
        }
      })
    ])
  );
  expect(fails(rs)[0]!.message).toBe('Duplicate id "x"');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/source-provider.test.ts && pnpm --filter @svelte-vitals/core exec vitest run test/a11y-route-rules.test.ts`
Expected: the five new tests FAIL.

- [ ] **Step 3: Implement**

`packages/cli/src/providers/source/routes.ts` — in `resolveRoute`, the `ids` value is currently built inline (`ids: representatives(literalIds, chainOrder)`). Extract and merge:

```ts
const ids = representatives(literalIds, chainOrder);
// Shell collision: the app.html occurrence is prepended as the always-first, never-penalized
// representative — sorted in, representativeOrder would rank it after chain files and invert
// the penalty. Iterate the folded map's own keys (never index by shell id: a shell
// id="constructor" would read Object.prototype).
if (appHtmlIds) {
  const shell = new Map(appHtmlIds.map((s) => [s.id, s.line]));
  for (const key of Object.keys(ids)) {
    const line = shell.get(key);
    if (line !== undefined) ids[key] = [{ file: 'src/app.html', line }, ...ids[key]!];
  }
}
```

and use `ids` in the returned object.

`packages/core/src/rules/a11y/route-rule.ts` — `surplusRule`'s spec type gains the fourth parameter: `message: (key: string, i: number, n: number, first: A11yOccurrenceInfo) => string;` and the emission passes it: `spec.message(key, i, reps.length, reps[0]!)`.

`packages/core/src/rules/a11y/id-duplication.ts`:

```ts
message: (id, _i, _n, first) =>
  first.file === 'src/app.html'
    ? `Duplicate id "${id}" — also defined by the src/app.html shell (line ${first.line})`
    : `Duplicate id "${id}"`,
```

- [ ] **Step 4: Run the suites**

Run: `pnpm --filter @svelte-vitals/core run build && pnpm --filter @svelte-vitals/core exec vitest run && pnpm --filter svelte-vitals exec vitest run`
Expected: PASS (the `duplicate-landmark` caller ignores the new argument; no other behavior moves).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/providers/source/routes.ts packages/core/src/rules/a11y/route-rule.ts packages/core/src/rules/a11y/id-duplication.ts packages/cli/test/source-provider.test.ts packages/core/test/a11y-route-rules.test.ts
git commit -m "feat(core): a11y/id-duplication detects route ids colliding with the app.html shell"
```

---

### Task 3: kitchen-sink plant, e2e-suppression relative assertions, docs, changeset

**Files:**

- Modify: `examples/kitchen-sink/src/routes/gallery/+page.svelte` (the plant)
- Modify: `examples/kitchen-sink/expected-findings.json` and `expected-findings.rendered.json` (`a11y/id-duplication` +1 each)
- Modify: `examples/kitchen-sink/test/e2e-suppression.test.ts` (two absolute assertions → relative)
- Modify: `docs/src/content/docs/rules/a11y/id-duplication.md` + ja (Mode differences)
- Create: `.changeset/shell-id-duplication.md`

**Interfaces:** consumes the built CLI with Tasks 1–2.

- [ ] **Step 1: Plant the collision**

`examples/kitchen-sink/src/routes/gallery/+page.svelte` is prerendered, outside `gallery/a11y/**` and `clean/**`, and has an existing `<h1>Gallery</h1>`. Change it to:

```svelte
<!-- a11y/id-duplication (shell collision): app.html's <div id="shell-root"> renders on every
     route, so this heading's id duplicates it. Source mode names the shell in the message;
     rendered mode has always counted this pair. -->
<h1 id="shell-root">Gallery</h1>
```

- [ ] **Step 2: Update the expectations**

- `examples/kitchen-sink/expected-findings.json`: `a11y/id-duplication` findings +1 (read the current value, increment).
- `examples/kitchen-sink/expected-findings.rendered.json`: `a11y/id-duplication` +1 — rendered mode already counted shell pairs; the equal increment is the mode-parity check.

- [ ] **Step 3: Make the two absolute e2e-suppression assertions relative**

In `examples/kitchen-sink/test/e2e-suppression.test.ts`, the test `'silences a route-scoped finding in a composed component and turns it into a PASS'` (around lines 233–249) asserts project-wide absolutes that any second id-duplication finding breaks. Replace the loop body's first two expectations:

```ts
for (const [i, args] of [[], scoped].entries()) {
  // Relative, not absolute: the gallery may legitimately carry other id-duplication findings
  // (the shell-collision plant); this test pins only that the directive silences exactly one
  // finding and synthesizes exactly one PASS.
  expect(findings(before[i]!, 'a11y/id-duplication')).toBeGreaterThanOrEqual(1);
  const { report } = run(dir, ...args);
  expect(findings(report, 'a11y/id-duplication')).toBe(findings(before[i]!, 'a11y/id-duplication') - 1);
  expect(passed(report, 'a11y/id-duplication')).toBe(passed(before[i]!, 'a11y/id-duplication') + 1);
}
```

Audit the rest of the file for other absolute `a11y/id-duplication` counts (the baseline-relative ones at ~281/301/305 and `issuesOn(report, '/gallery/a11y', …)` are unaffected by a plant outside that prefix — verify, don't assume).

- [ ] **Step 4: Build and run the kitchen-sink suites**

Run: `pnpm build && pnpm --filter kitchen-sink exec vitest run`
Expected: PASS — e2e-static (new counts), e2e-build (rendered +1), e2e-suppression (relative form; the scoped iteration still computes 1→0 because the plant is outside `gallery/a11y/**`). If any OTHER rule's count moved, the plant brushed it — adjust the plant, not that expectation.

- [ ] **Step 5: Docs (en, then ja) and stamp**

`docs/src/content/docs/rules/a11y/id-duplication.md`, Mode differences: delete the second bullet ("**Source analysis** … also does not report a page id that collides with one in `src/app.html` …") and replace it with:

```markdown
- Both modes report a page id that collides with one in `src/app.html`: source analysis prepends the shell occurrence as the first, never-flagged representative, so the finding sits on the route-side occurrence and its message names the shell (`— also defined by the src/app.html shell (line N)`).
```

In the rendered bullet, drop "including a collision with a shell id and" (the collision is no longer a divergence; the `{#each}` clause stays). Mirror both edits in the ja page, then:

```bash
pnpm --filter docs run translate:stamp "src/content/docs/rules/a11y/id-duplication.md"
```

- [ ] **Step 6: Changeset**

`.changeset/shell-id-duplication.md`:

```markdown
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

`a11y/id-duplication` now detects a route id colliding with an id in the `src/app.html`
shell in source mode (rendered mode always did): the finding sits on the route-side
occurrence and its message names the shell line. This is a new arm of an existing rule:
`findingKey` is `id::route::location` with no line component, so a project with an
existing suppressed `a11y/id-duplication` entry for the same route and file already has
the new finding pre-suppressed; projects without one will see new findings, and
`--update-suppressions` adopts them in one run. Diff-scoped runs (`--diff`/`--staged`)
only surface the finding when the route file changes — an edit to `src/app.html` alone
shows up on full runs.
```

- [ ] **Step 7: Full verification and commit**

```bash
pnpm format && pnpm build && pnpm typecheck && pnpm test && pnpm lint
git add examples/kitchen-sink docs/src/content/docs docs/blume.translations.json .changeset/shell-id-duplication.md
git commit -m "test(cli): shell-collision sample, mode-parity docs, changeset for shell-id duplication"
```

Expected: all green, including `io-budget.test.ts` (the shell ids come from the existing single `app.html` read — no new I/O).

---

## After the plan

Branch finish via superpowers:finishing-a-development-branch — PR to `main` (never a direct push). The PR closes roadmap C-7; note in the body that the findingKey question was resolved by construction (no out-of-route location exists).
