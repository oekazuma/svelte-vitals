# Unit Note Reachability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all three of `architecture/reserved-name-placement`'s dead-declaration reasons ask whether a glob **can reach** what it needs, instead of whether it **did work** — which is what makes the rule report correct declarations and stay silent about broken ones.

**Architecture:** One directory list is computed once — every directory the rule saw, minus the ones the globally resolved `exclude` prunes — plus the live units of each kind derived from it. The three reasons then read off that: no directory at all, no _live_ directory, or (unit maps only) no live unit of the required kind. `classifyUnusedKeys`, `excludedDirs` and `nonUnitParents` all go, because each encoded a usage question.

**Tech Stack:** TypeScript, vitest, `@svelte-vitals/core`'s rule engine.

Design: `docs/superpowers/specs/2026-08-07-unit-note-reachability-design.md` (approved after adversarial review, 2026-08-07). Read it before Task 1 — the two measured cases and the control are the specification.

## Global Constraints

- **A declaration is dead for being unable to reach anything, not for going unused.** That sentence is already in the rule's own reachability-guard comment; this plan extends it to the other two reasons.
- **Only the globally resolved `exclude` is used for the diagnostics**, matching the rule's existing decision that only globally resolved declarations are diagnosed at all. Do not resolve `exclude` per directory for this purpose.
- **`placements` has no unit requirement and must never receive the unit note.**
- **The new message must not contain the word "matched"** — that word is what makes the current message a usage claim. Use `reaches no unit`.
- **One aggregated project-scoped finding**, `route` and `location` unset. Changing a reason must not change that shape.
- `packages/core` has **no `node:` imports, no I/O, no runtime-specific globals**.
- **Never name another tool, linter, plugin, product or automated reviewer** in code, tests, docs, changeset or commit messages. PR bodies are written in English.
- Read `AGENTS.md` first, especially the comment convention: a comment earns its place only when it says something the code cannot; prefer one line over three.
- **Verify commands — use these exact invocations.** A `pnpm --filter` package-suite run times out in this sandbox. From the repo root:
  - one test file: `cd packages/core && ../../node_modules/.bin/vitest run test/<file>.test.ts`
  - whole core suite: `cd packages/core && ../../node_modules/.bin/vitest run`
  - cli and vite suites: same pattern from `packages/cli` and `packages/vite`
  - typecheck: `cd packages/<pkg> && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
  - lint: `./node_modules/.bin/oxlint .` — format: `./node_modules/.bin/oxfmt --write .` then `--check .`
  - Never run `pnpm install`. Never background a run.

---

## File Structure

| File                                                                          | Responsibility                                                                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/rules/architecture/reserved-name-placement.ts`             | **Modify.** All three reasons become reach questions; `excludedDirs`, `nonUnitParents` and the `classifyUnusedKeys` import are deleted.           |
| `packages/core/test/reserved-name-placement.test.ts`                          | **Modify.** Four behaviours change and need new tests; one existing test is rewritten because its fixture cannot reach the path it claims to pin. |
| `docs/src/content/docs/rules/architecture/reserved-name-placement.md` + `ja/` | **Modify.** The bare-glob paragraph and the reason list.                                                                                          |
| `.changeset/unit-note-reachability.md`                                        | **Create.** Patch for the three packages that ship the rule.                                                                                      |

**One existing test is rewritten, not deleted.** `claims the unit reason for a glob that also matched an excluded directory` was verified load-bearing when written, and a later fix on the same branch — recording the excluded _parent_ rather than the reserved-name directory — silently hollowed it out. Its fixture no longer reaches the excluded path at all. The replacement uses a fixture that does. **Verified by execution while writing this plan:** with the two classification passes genuinely swapped, all 28 tests pass today; restoring the older `excludedDirs.push(dir)` semantics _and_ keeping the swap makes it fail again.

---

## Task 1: The excluded reason stops being a usage claim

**Files:**

- Modify: `packages/core/src/rules/architecture/reserved-name-placement.ts`
- Modify: `packages/core/test/reserved-name-placement.test.ts`

**Interfaces:**

- Consumes: `isExcluded`, `keysMatchingAny`, `ancestorDirs`, `listOption` — all already imported by this file.
- Produces: two module-local values Task 2 builds on, declared immediately after `const allDirs = [...dirs].sort();`:
  ```ts
  const globalExcluded: CompiledKey[]; // compile(listOption(globalOptions, 'exclude'))
  const liveDirs: string[]; // allDirs minus what globalExcluded prunes
  ```

**Why this is separable from Task 2.** `classifyUnusedKeys` marks a key `only-excluded` when it matches **at least one** recorded excluded directory. That is correct in `reserved-directory-names`, where matching any live directory records the key as used — so "unused and matches an excluded directory" really does mean the excluded ones were its only matches. **This rule does not have that property:** `usedAlternatives` is recorded only where an alternative _permitted a position_, so an alternative can reach live directories, be entirely correct, and still be unused. That is a false positive today, independent of the unit note.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe` in `packages/core/test/reserved-name-placement.test.ts`. Read the file's existing `run(files, options, extra)` helper and `projectScoped` helper first and reuse them.

```ts
it('does not call a declaration excluded when its glob reaches a live directory', async () => {
  const results = await run(['src/lib/Panel/Panel.svelte', 'src/lib/legacy/parts/b.svelte', 'src/lib/other/x.ts'], {
    capitalisedUnitPlacements: { parts: 'src/lib/*' },
    exclude: ['src/lib/legacy/**']
  });
  const notes = projectScoped(results);
  for (const n of notes) expect(n.message).not.toContain('matched only excluded directories');
});

it('calls a declaration excluded when every directory its glob reaches is excluded', async () => {
  const results = await run(['src/lib/legacy/parts/a.svelte', 'src/routes/+page.svelte'], {
    capitalisedUnitPlacements: { parts: 'src/lib/legacy/*' },
    exclude: ['src/lib/legacy/**']
  });
  const notes = projectScoped(results);
  expect(notes).toHaveLength(1);
  expect(notes[0]?.message).toContain('matched only excluded directories');
});
```

- [ ] **Step 2: Run them to verify the first fails**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/reserved-name-placement.test.ts`
Expected: the first test FAILS — today the glob reaches a live unit and is still labelled excluded. The second passes already; it is the guard that the excluded reason still works after the change. Record both observations.

- [ ] **Step 3: Build the live directory list**

In `packages/core/src/rules/architecture/reserved-name-placement.ts`, immediately after `const allDirs = [...dirs].sort();`:

```ts
// The diagnostics below judge a declaration by what its glob can reach, not by what it happened to
// govern — a declaration saying where a name MAY sit is not dead for going unused. `exclude` is
// taken from the global resolution only, matching the rule's decision to diagnose only globally
// resolved declarations.
const globalExcluded = compile(listOption(globalOptions, 'exclude'));
const liveDirs = allDirs.filter((d) => !isExcluded(d, ancestorDirs(d), globalExcluded));
```

- [ ] **Step 4: Replace the excluded and no-directory reasons**

Replace the block that begins `const reasons = classifyUnusedKeys(globs, excludedDirs, compile);` and ends with the closing brace of the `for (const k of stillUnused)` loop with:

```ts
const reachesAny = keysMatchingAny(globs, allDirs, compile);
const reachesLive = keysMatchingAny(globs, liveDirs, compile);
for (const k of stillUnused) {
  const glob = globOf(k);
  if (!reachesAny.has(glob)) notes.set(k, 'matched no directory');
  else if (!reachesLive.has(glob)) notes.set(k, 'matched only excluded directories');
}
```

Delete the `classifyUnusedKeys` entry from the import list at the top of the file, and delete `const excludedDirs: string[] = [];` together with the `if (isExcluded(parent, …)) excludedDirs.push(parent);` line and the three-line comment above it inside the exclusion branch. The `continue` on that branch stays.

- [ ] **Step 5: Run the tests**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/reserved-name-placement.test.ts`
Expected: PASS. Both new tests, and every pre-existing one — **except** `claims the unit reason for a glob that also matched an excluded directory`, which may now behave differently. If it fails, **stop and report** rather than editing it: Task 2 rewrites it deliberately and doing it here would hide which change caused what.

- [ ] **Step 6: Verify each guard is load-bearing**

| Break                                                | Test that must fail                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `liveDirs` filter dropped, so `liveDirs === allDirs` | "calls a declaration excluded when every directory its glob reaches is excluded" |
| `reachesLive` computed against `allDirs`             | same as above                                                                    |
| the `!reachesAny.has(glob)` branch removed           | an existing "matched no directory" test                                          |

If a break causes no failure, the test is vacuous — say which and strengthen it.

- [ ] **Step 7: Run the whole core suite and typecheck**

Run: `cd packages/core && ../../node_modules/.bin/vitest run` then `../../node_modules/.bin/tsc --noEmit -p tsconfig.json`

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/rules/architecture/reserved-name-placement.ts packages/core/test/reserved-name-placement.test.ts
git commit -m "fix(core): judge an excluded declaration by reach, not by what it governed"
```

---

## Task 2: The unit note asks about reach

**Files:**

- Modify: `packages/core/src/rules/architecture/reserved-name-placement.ts`
- Modify: `packages/core/test/reserved-name-placement.test.ts`

**Interfaces:**

- Consumes: `liveDirs` from Task 1; `isUnitDir` and `isAnyCaseUnitDir`, already imported by this file.
- Produces: nothing later tasks depend on.

**The two measured cases this exists for**, both reproduced against the shipped rule:

| case                                                   | config and tree                                                                                                  | today                            |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **A** the convention permits a position that is unused | `anyCaseUnitPlacements: { types: 'src/**' }`, the one `types/` sitting under a non-unit that `placements` covers | **reports** — a false claim      |
| **B** a real mistake                                   | `capitalisedUnitPlacements: { parts: 'src/lib' }`, a unit at `src/lib/Card` holding `parts/`                     | **one violation, no diagnostic** |

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe`:

```ts
it('says nothing about a unit-map glob that reaches a live unit the name has not used yet', async () => {
  const results = await run(['src/lib/Card/Card.svelte', 'src/lib/db/types/t.ts'], {
    anyCaseUnitPlacements: { types: 'src/**' },
    placements: { types: 'src/lib/db' }
  });
  expect(projectScoped(results)).toEqual([]);
});

it('reports a unit-map glob that reaches no unit of its kind', async () => {
  const results = await run(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/a.svelte'], {
    capitalisedUnitPlacements: { parts: 'src/lib' }
  });
  const notes = projectScoped(results);
  expect(notes).toHaveLength(1);
  expect(notes[0]?.message).toContain('reaches no unit');
});

it('says nothing once that glob is corrected to reach the unit', async () => {
  const results = await run(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/a.svelte'], {
    capitalisedUnitPlacements: { parts: 'src/lib/**' }
  });
  expect(projectScoped(results)).toEqual([]);
});

it('does not let one unit map borrow the other kind of unit', async () => {
  const tree = ['src/lib/formatDate/formatDate.ts', 'src/lib/formatDate/parts/a.svelte'];
  const cap = await run(tree, { capitalisedUnitPlacements: { parts: 'src/**' } });
  expect(projectScoped(cap)[0]?.message).toContain('reaches no unit');
  const any = await run(tree, { anyCaseUnitPlacements: { parts: 'src/**' } });
  expect(projectScoped(any)).toEqual([]);
});

it('honours the bare-prefix guard when looking for a unit', async () => {
  // `src/lib/Card/**` does not reach `src/lib/Card` itself, which is the only capitalised unit here.
  const results = await run(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/a.svelte'], {
    capitalisedUnitPlacements: { parts: 'src/lib/Card/**' }
  });
  const notes = projectScoped(results);
  expect(notes).toHaveLength(1);
  expect(notes[0]?.message).toContain('reaches no unit');
});

it('reports a unit-map glob whose only unit of the kind is excluded', async () => {
  const results = await run(['src/lib/legacy/Card/Card.svelte', 'src/lib/utils/parts/a.svelte', 'src/lib/utils/x.ts'], {
    capitalisedUnitPlacements: { parts: 'src/lib/**' },
    exclude: ['src/lib/legacy/**']
  });
  const notes = projectScoped(results);
  expect(notes).toHaveLength(1);
  expect(notes[0]?.message).toContain('reaches no unit');
});

it('never gives a placements declaration the unit note', async () => {
  const results = await run(['src/lib/utils/x.ts', 'src/lib/utils/e2e/a.ts'], {
    placements: { e2e: 'src/lib/*' }
  });
  for (const n of projectScoped(results)) expect(n.message).not.toContain('reaches no unit');
});
```

- [ ] **Step 2: Run them to verify which fail**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/reserved-name-placement.test.ts`
Expected: the first two FAIL — case A reports today and case B reports nothing. Record each test's actual pre-change result; the brief's prediction for the others is not a substitute for observing them.

- [ ] **Step 3: Rewrite the hollow ordering test**

The existing test `claims the unit reason for a glob that also matched an excluded directory` cannot reach the excluded path: its `exclude: ['src/lib/parts/**']` does not exclude `src/lib`, so nothing was ever recorded. Replace it with one whose excluded directory is the _parent_:

```ts
it('prefers the excluded reason when a glob reaches nothing live', async () => {
  const results = await run(['src/lib/legacy/parts/a.svelte', 'src/routes/+page.svelte'], {
    capitalisedUnitPlacements: { parts: 'src/lib/legacy/*' },
    exclude: ['src/lib/legacy/**']
  });
  const notes = projectScoped(results);
  expect(notes).toHaveLength(1);
  expect(notes[0]?.message).toContain('matched only excluded directories');
  expect(notes[0]?.message).not.toContain('reaches no unit');
});
```

- [ ] **Step 4: Build the live unit sets and replace the unit pass**

Immediately after the `liveDirs` line from Task 1:

```ts
const liveUnits: Record<'capitalisedUnitPlacements' | 'anyCaseUnitPlacements', string[]> = {
  capitalisedUnitPlacements: liveDirs.filter((d) => isUnitDir(d, filesIn)),
  anyCaseUnitPlacements: liveDirs.filter((d) => isAnyCaseUnitDir(d, filesIn))
};
```

Delete the `nonUnitParents` declaration and the `if (map !== 'placements') nonUnitParents[map].push(parent);` line inside `record()` — with that line gone, the `if (!qualifies)` branch is just `return false`.

Then delete the whole unit pass that currently runs **before** the excluded/no-directory loop, and add this **after** that loop instead:

```ts
// Last: a glob with live reach is judged on whether that reach includes a unit of the kind its map
// requires. Ordered after the two above because "the exclusion pruned everything" and "the path does
// not exist" are the more specific answers, and both are actionable on their own.
for (const map of ['capitalisedUnitPlacements', 'anyCaseUnitPlacements'] as const) {
  const inMap = stillUnused.filter((k) => !notes.has(k) && globalAlternatives.get(k)?.map === map);
  const reachesUnit = keysMatchingAny(inMap.map(globOf), liveUnits[map], compile);
  for (const k of inMap) if (!reachesUnit.has(globOf(k))) notes.set(k, 'reaches no unit');
}
```

- [ ] **Step 5: Run the tests**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/reserved-name-placement.test.ts`
Expected: PASS, every test including the rewritten one.

- [ ] **Step 6: Verify each guard is load-bearing**

| Break                                                                    | Test that must fail                                               |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `liveUnits[map]` → `liveDirs` (no unit filter)                           | "reports a unit-map glob that reaches no unit of its kind"        |
| both entries of `liveUnits` set to the any-case predicate                | "does not let one unit map borrow the other kind of unit"         |
| `liveUnits` built from `allDirs` instead of `liveDirs`                   | "reports a unit-map glob whose only unit of the kind is excluded" |
| the unit pass moved back **above** the excluded loop                     | "prefers the excluded reason when a glob reaches nothing live"    |
| `compile(…)` inside `keysMatchingAny` losing its bare guard              | "honours the bare-prefix guard when looking for a unit"           |
| the `map === 'placements'` exclusion dropped by iterating all three maps | "never gives a placements declaration the unit note"              |

Every row must fail exactly the named test. If one causes no failure, say which and strengthen the test rather than moving on — this rule has already shipped one ordering test that pinned nothing.

- [ ] **Step 7: Confirm nothing is left over**

```bash
grep -n "nonUnitParents\|excludedDirs\|classifyUnusedKeys" packages/core/src/rules/architecture/reserved-name-placement.ts
```

Expected: no output. Then run the whole core suite, the cli suite, typecheck for core and cli, lint and format.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/rules/architecture/reserved-name-placement.ts packages/core/test/reserved-name-placement.test.ts
git commit -m "fix(core): ask whether a unit-map glob reaches a unit, not whether it governed one"
```

---

## Task 3: Documentation and changeset

**Files:**

- Modify: `docs/src/content/docs/rules/architecture/reserved-name-placement.md`
- Modify: `docs/src/content/docs/ja/rules/architecture/reserved-name-placement.md`
- Create: `.changeset/unit-note-reachability.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Correct the reason list**

The English page lists the three reasons. The unit one currently reads:

> a unit-map glob matched real directories, but none of them was a unit of the required case — reported as "matched directories but never a unit". This catches the bare-glob mistake above only where the reserved name sits **directly in** the glob's own directory: `parts: 'src/lib'` says nothing about a `src/lib/Card/parts`, because the directory it checks is that `parts/`'s parent — `src/lib/Card` — which the glob never matched. Write `src/lib/**`, not `src/lib`.

Replace it with what the code now does: the glob reaches no unit of the kind its map requires, reported as `reaches no unit`, and it **does** catch the bare-glob mistake — `parts: 'src/lib'` reaches no capitalised unit at all, so it is reported. Keep the "Write `src/lib/**`, not `src/lib`" advice; it is the fix either way.

Check the other two reasons in that list too: the excluded one should now say the glob reaches no directory the exclusion left live, not that it matched an excluded one.

- [ ] **Step 2: Note that the page reversed**

The narrowing you are removing was itself a correction, made when a review proved by execution that the note did not catch the bare-glob mistake. It does now. Add one sentence to the page's Limitations section recording that a declaration is judged by what its glob can reach, so a correct declaration for a position nothing occupies yet stays silent — and that a glob scoped to a subtree whose units do not exist yet is reported, on the same footing as a glob naming a directory that does not exist yet.

- [ ] **Step 3: Mirror both changes in Japanese**

Same claims, same order, same paragraph count. Reuse the Japanese page's existing terminology for ユニット, グロブ, 宣言 and 除外 rather than inventing new wording.

- [ ] **Step 4: Run the docs gates**

```bash
cd packages/cli && ../../node_modules/.bin/vitest run test/docs-links.test.ts test/rules-index.test.mjs test/docs-embed.test.mjs
```

Then check whether `packages/cli/docs/` mentions the unit reason at all — `grep -rn "never a unit\|reaches no unit" packages/cli/docs/`. If it does, correct it and regenerate with `cd packages/cli && node scripts/gen-docs.mjs`. If it does not, say so in your report.

- [ ] **Step 5: Write the changeset**

`pnpm changeset` is interactive and unavailable. Write `.changeset/unit-note-reachability.md` by hand, following the shape of an existing entry. **Patch**, listing `@svelte-vitals/core`, `svelte-vitals` and `@svelte-vitals/vite` — the rule ships in all three. Verify that with `git diff --stat` against the merge base before writing it.

The body must say: the rule's diagnostic told you to fix a declaration that was correct and simply unused, while saying nothing about a glob that could never match anything — both because the check asked what a declaration had done rather than what it could reach. Findings themselves do not change; only which declarations the diagnostic names.

- [ ] **Step 6: Format, lint, commit**

```bash
./node_modules/.bin/oxfmt --write . && ./node_modules/.bin/oxfmt --check . && ./node_modules/.bin/oxlint .
git add -A
git commit -m "docs: describe the dead-declaration reasons as reach questions"
```

---

## Self-Review

**Spec coverage.** Design testing items map as: 1 → Task 2 test 1; 2 → Task 2 test 2; 3 → Task 2 test 3; 4 → Task 2 test 4; 5 → Task 2's rewritten ordering test; 6 → Task 1 test 1; 7 → Task 2 test 6; 8 → Task 2 test 5; 9 → Task 2 test 7; 10 → covered by the existing aggregation test, which Task 2 Step 5 requires to keep passing. The design's "must not say matched" constraint is in Global Constraints and enforced by the `toContain('reaches no unit')` assertions. Dead-code removal is Task 2 Step 4 and verified by Task 2 Step 7's grep.

**Deliberately not implemented**, matching the design: reporting a declared position that is legitimately unused; a glob scoped to a subtree whose units do not exist yet (kept as a report, recorded in the docs by Task 3 Step 2); `placements` globs that reach no plausible parent.
