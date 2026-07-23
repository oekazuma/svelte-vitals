# unmutated-state Directive Escape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `correctness/unmutated-state` from flagging `$state` that is handed to a `use:`/`transition:`/`animate:` directive — the receiving code holds the proxy reference and may mutate it invisibly, so the `$state.raw` suggestion would break it.

**Architecture:** One wiring line: the existing `collectDirectiveEscapes` (built for `performance/state-raw`) joins the `constableStates` disqualification pass. The shared `collectTemplateEscapes` stays untouched, so `stale-prop-derivation` is byte-identical.

**Tech Stack:** TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-07-23-unmutated-state-directive-escape-design.md` (approved).

## Global Constraints

- Strictly narrowing: `unmutated-state` may only LOSE findings; `stale-prop-derivation` and `state-raw` behavior must be byte-identical (their suites pin this).
- Changeset: **patch** × `@svelte-vitals/core` / `svelte-vitals` / `@svelte-vitals/vite` / `@svelte-vitals/mcp`.
- Environment: pnpm is BROKEN — NEVER run any pnpm command or install. Direct binaries: `cd packages/core && ../../node_modules/.bin/vitest run <pattern>`, `../../node_modules/.bin/tsc --noEmit`, `../../node_modules/.bin/tsup` for builds, `node_modules/.bin/oxfmt <files>` / `node_modules/.bin/oxfmt --check .` / `node_modules/.bin/oxlint .` from the root, `cd docs && node_modules/.bin/astro build`.
- `node_modules/.bin/oxfmt` on every touched file before each commit.

---

### Task 1: Wire, test, document

**Files:**

- Modify: `packages/core/src/component-parse.ts` (one call added near line 1775; `collectDirectiveEscapes` doc comment near line 786)
- Test: `packages/core/test/component-parse.test.ts` (append; if the file has no `constableStates` describe block, add the new `describe` at the end)
- Modify: `docs/src/content/docs/rules/correctness/unmutated-state.md` + `docs/src/content/docs/ja/rules/correctness/unmutated-state.md`
- Create: `.changeset/unmutated-state-directive-escape.md`
- Modify: `packages/action/dist/*` (rebuild)

**Interfaces:**

- Consumes: existing `collectDirectiveEscapes(node, names, acc)` (component-parse.ts ~line 786) and the `constableStates` disqualification block (~lines 1771–1778).

- [ ] **Step 1: Write the failing parse tests**

Append to `packages/core/test/component-parse.test.ts`:

```ts
describe('constableStates — directive escapes', () => {
  const constable = (src: string) => parseComponentFacts(src, 'A.svelte').constableStates;

  it('does not report $state handed to a use: directive', () => {
    const src = `<script>\nlet obj = $state({});\n</script>\n<div use:draggable={obj}>x</div>`;
    expect(constable(src)).toEqual([]);
  });

  it('does not report $state handed to a transition: directive', () => {
    const src = `<script>\nlet params = $state({ duration: 200 });\n</script>\n<div transition:fly={params}>x</div>`;
    expect(constable(src)).toEqual([]);
  });

  it('still reports untouched $state, including next to unrelated directives', () => {
    const src = `<script>\nlet obj = $state({});\nlet other = $state({});\n</script>\n<div use:draggable={other}>x</div>`;
    expect(constable(src)).toEqual([{ name: 'obj', line: 2 }]);
  });
});
```

(Reuse the file's existing import of `parseComponentFacts`; if the file wraps parsing in a local helper, the inline `constable` helper above is still fine — it only needs `parseComponentFacts`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && ../../node_modules/.bin/vitest run component-parse`
Expected: the two "does not report" tests FAIL (the directive-bound states currently land in `constableStates`); the third passes.

- [ ] **Step 3: Implement — one wiring line + doc comment**

In `packages/core/src/component-parse.ts`, inside the `constableStates` disqualification block (currently):

```ts
const writtenOrEscaped = new Set<string>();
collectStateWrites(program, stateNames, writtenOrEscaped);
if (ast.fragment) {
  collectStateWrites(ast.fragment, stateNames, writtenOrEscaped);
  collectTemplateEscapes(ast.fragment, stateNames, writtenOrEscaped);
}
```

add one line so the fragment branch reads:

```ts
if (ast.fragment) {
  collectStateWrites(ast.fragment, stateNames, writtenOrEscaped);
  collectTemplateEscapes(ast.fragment, stateNames, writtenOrEscaped);
  collectDirectiveEscapes(ast.fragment, stateNames, writtenOrEscaped);
}
```

Then update `collectDirectiveEscapes`'s doc comment (currently scoped to `performance/state-raw` only) to:

```ts
/**
 * Directive expressions that hand a value to arbitrary code — `use:action={obj}`,
 * `transition:fn={obj}`, `animate:fn={obj}` — are reference handoffs, the same class
 * as a call argument. Serves `performance/state-raw` and `correctness/unmutated-state`
 * (the receiving code may mutate the proxy invisibly, so such state is neither
 * raw-able nor "unused"). The shared template-escape collector deliberately still
 * excludes directives so `correctness/stale-prop-derivation`'s disqualification set
 * is unchanged — a stale prop-derived value handed to an action is still worth flagging.
 */
```

- [ ] **Step 4: Run tests to verify they pass, then the neighboring suites**

Run: `cd packages/core && ../../node_modules/.bin/vitest run component-parse` → PASS (all, incl. the 3 new).
Run: `cd packages/core && ../../node_modules/.bin/vitest run` → full core suite green (state-raw and stale-prop suites pin their unchanged behavior).
Run: `cd packages/core && ../../node_modules/.bin/tsc --noEmit` → clean.

- [ ] **Step 5: Docs (en/ja)**

In `docs/src/content/docs/rules/correctness/unmutated-state.md`, find the section listing what is not flagged (read the page first; if there is no such list, append the sentence to the "What it checks" paragraph):

```markdown
State passed to a `use:`/`transition:`/`animate:` directive is not flagged either — the receiving code holds the reference and may mutate it invisibly.
```

ja mirror (`docs/src/content/docs/ja/rules/correctness/unmutated-state.md`, same position, full-width parentheses conventions):

```markdown
`use:`／`transition:`／`animate:` ディレクティブに渡した state も検出しません。受け取った側が参照を保持し、静的解析には見えない形で変更しうるためです。
```

- [ ] **Step 6: Changeset**

Create `.changeset/unmutated-state-directive-escape.md`:

```markdown
---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
'@svelte-vitals/mcp': patch
---

`correctness/unmutated-state` no longer flags `$state` passed to a `use:`/`transition:`/`animate:` directive — the receiving code holds the proxy reference and may mutate it invisibly, so the previous `$state.raw` suggestion could break it.
```

- [ ] **Step 7: Builds and verify — direct binaries**

```bash
cd packages/core && ../../node_modules/.bin/tsup && cd ../..
cd packages/cli && ../../node_modules/.bin/tsup && ../../node_modules/.bin/vitest run && cd ../..
cd packages/vite && ../../node_modules/.bin/tsup && ../../node_modules/.bin/vitest run && cd ../..
cd packages/mcp && ../../node_modules/.bin/tsup && cd ../..
cd packages/action && ../../node_modules/.bin/tsup && cd ../..
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
cd docs && node_modules/.bin/astro build && cd ..
git status --short packages/action/dist
```

Expected: all green; commit the regenerated action dist. (Check each package.json build script is plain `tsup` before running; STOP and report if one needs pnpm.)

- [ ] **Step 8: Commit (two commits)**

```bash
node_modules/.bin/oxfmt packages/core/src/component-parse.ts packages/core/test/component-parse.test.ts
git add packages/core/src/component-parse.ts packages/core/test/component-parse.test.ts docs/src/content/docs/rules/correctness/unmutated-state.md docs/src/content/docs/ja/rules/correctness/unmutated-state.md .changeset/unmutated-state-directive-escape.md
git commit -m "fix(core): treat directive expressions as escapes in unmutated-state"
git add packages/action/dist
git commit -m "chore(action): rebuild dist"
```
