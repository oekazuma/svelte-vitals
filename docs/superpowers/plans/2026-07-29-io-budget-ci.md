# I/O Budget CI Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Defend svelte-vitals' analysis speed with a CI gate that counts `Runtime` calls instead of wall-clock time, so it can never be flaky.

**Architecture:** Extract the analysis I/O phase into `packages/cli/src/collect-all.ts`, then hold that real function to a fixed I/O budget from `packages/cli/test/io-budget.test.ts` using a counting `Runtime` wrapper over the existing in-memory `Runtime`. No new CI job — the test rides the existing `test` job. The existing timing benchmark is promoted from throwaway script to documented manual tool.

**Tech Stack:** TypeScript, vitest, pnpm workspaces, oxlint/oxfmt.

**Spec:** `docs/superpowers/specs/2026-07-29-io-budget-ci-design.md`

## Global Constraints

- **Public API must not change.** `collect-all.ts` and `route-matcher.ts` are NOT re-exported from `packages/cli/src/index.ts` except for `routeMatcher`, which is already public and must stay exported from `index.ts`. Tests import internal modules by path, matching `packages/cli/test/parse-cache.test.ts`.
- **No `@svelte-vitals/core` source changes.** Core purity rule (no `node:` imports, no I/O) is untouched because we do not modify `packages/core/src` at all.
- **No changeset.** This is an internal-only change; `AGENTS.md` requires changesets only for user-facing changes.
- **Budget constant is `MAX_READS_PER_FILE = 2`** — the measured status quo, not an ideal. Lowering it is welcome; raising it needs a recorded reason.
- **Conventional commits, scoped by package**: `refactor(cli):`, `test(cli):`, `chore(vite):`, `docs:`.
- **Verify before claiming done**: `pnpm lint`, `pnpm typecheck`, `pnpm test` must all pass. Run `pnpm format` before committing (oxfmt).
- `tsconfig.base.json` sets `strict: true` but NOT `exactOptionalPropertyTypes`, so passing a possibly-`undefined` value to an optional property is allowed.

---

### Task 1: Move `routeMatcher` into its own module

`collectAll` needs `routeMatcher`, but `routeMatcher` currently lives in `index.ts`, which will import `collect-all.ts`. Moving it first avoids a circular import. This is a pure move: no behaviour changes.

**Files:**

- Create: `packages/cli/src/route-matcher.ts`
- Modify: `packages/cli/src/index.ts:127-140` (remove the function), and add a re-export
- Test: `packages/cli/test/route-matcher.test.ts` (exists already; imports from `../src/index.js` and must keep passing unchanged)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `routeMatcher(glob: string | undefined): (route: string) => boolean`, importable from `./route-matcher.js`. Task 2 imports it.

- [ ] **Step 1: Confirm the existing test passes before touching anything**

Run: `pnpm --filter svelte-vitals exec vitest run test/route-matcher.test.ts`
Expected: PASS. If it does not pass, stop — the tree is not clean.

- [ ] **Step 2: Create the new module**

Create `packages/cli/src/route-matcher.ts` with the function moved verbatim from `index.ts`:

```ts
/**
 * Match a route path against a glob (`blog/*`, `**\/admin`, `static/**`). An
 * undefined glob matches everything. Lives in its own module so `collect-all.ts`
 * can use it without importing `index.ts` (which imports `collect-all.ts`).
 */
export function routeMatcher(glob: string | undefined): (route: string) => boolean {
  if (!glob) return () => true;
  const body = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, ' ') // globstar placeholder
    .replace(/\*/g, '[^/]*') // single-segment wildcard (placeholder untouched)
    .replace(/\/ $/g, '(?:/.*)?') // trailing /** -> optional subtree
    .replace(/^ \//g, '(?:.*/)?') // leading **/ -> optional prefix
    .replace(/ \//g, '(?:.*/)?') // internal **/ -> optional prefix
    .replace(/\/ /g, '(?:/.*)?') // internal /** -> optional subtree
    .replace(/ /g, '.*'); // bare ** -> .*
  const re = new RegExp(`^${body}$`);
  return (route) => re.test(route.replace(/^\//, ''));
}
```

Note: the `**\/admin` in the doc comment above is escaped only to survive this markdown code fence — write it as `**/admin` in the actual file.

- [ ] **Step 3: Remove the old copy from `index.ts` and re-export**

Delete lines 127-140 of `packages/cli/src/index.ts` (the whole `export function routeMatcher` block). Add this to the re-export block near the bottom of the file, next to the existing `export { ProjectError } from './providers/source/project.js';` (line 544):

```ts
export { routeMatcher } from './route-matcher.js';
```

The public API is unchanged: `routeMatcher` is still exported from `index.ts`.

- [ ] **Step 4: Run the test suite**

Run: `pnpm --filter svelte-vitals exec vitest run`
Expected: PASS, same test count as before the move.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass. If lint reports formatting, run `pnpm format` and re-run.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/route-matcher.ts packages/cli/src/index.ts
git commit -m "refactor(cli): move routeMatcher into its own module"
```

---

### Task 2: Extract the collection phase into `collectAll`

**Files:**

- Create: `packages/cli/src/collect-all.ts`
- Modify: `packages/cli/src/index.ts` (imports at lines 20/28/30/31, and `analyzeProject` body at lines 206-217)
- Test: `packages/cli/test/collect-all.test.ts` (new)

**Interfaces:**

- Consumes: `routeMatcher` from `./route-matcher.js` (Task 1).
- Produces:
  - `interface CollectedFacts { heads: ResolvedHead[]; images: ResolvedImages[]; headings: ResolvedHeadings[]; project: Project; components: ComponentFacts[]; kitModules: KitModuleFacts[] }`
  - `interface CollectAllOptions { route?: string; parseCache?: ParseCache }`
  - `collectAll(rt: Runtime, cwd: string, config: Config, opts?: CollectAllOptions): Promise<CollectedFacts>`

  Tasks 4 and 5 call `collectAll` and rely on these exact names.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/test/collect-all.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { defaultConfig } from '@svelte-vitals/core';
import { collectAll } from '../src/collect-all.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

const PROJECT = {
  'src/app.html': `<!doctype html><html lang="en"><body></body></html>`,
  'src/routes/+layout.svelte': `<script>let { children } = $props();</script>{@render children()}`,
  'src/routes/a/+page.svelte': `<svelte:head><title>A</title></svelte:head><h1>A</h1>`,
  'src/routes/b/+page.svelte': `<svelte:head><title>B</title></svelte:head><h1>B</h1>`,
  'src/lib/Card.svelte': `<script>let { title = '' } = $props();</script><h3>{title}</h3>`
};

describe('collectAll', () => {
  it('returns facts for every route plus project-wide and component facts', async () => {
    const rt = createMemoryRuntime(PROJECT);

    const facts = await collectAll(rt, '', defaultConfig);

    expect(facts.heads.map((h) => h.route).sort()).toEqual(['/a', '/b']);
    expect(facts.images.map((i) => i.route).sort()).toEqual(['/a', '/b']);
    expect(facts.headings.map((h) => h.route).sort()).toEqual(['/a', '/b']);
    expect(facts.project.htmlLang).toEqual({ presence: 'own', value: 'static' });
    // Every .svelte under src/ is scanned, routes and $lib alike.
    expect(facts.components.map((c) => c.file).sort()).toEqual([
      'src/lib/Card.svelte',
      'src/routes/+layout.svelte',
      'src/routes/a/+page.svelte',
      'src/routes/b/+page.svelte'
    ]);
    expect(facts.kitModules).toEqual([]);
  });

  it('filters route-scoped facts and skips component/kit-module scanning when route is set', async () => {
    const rt = createMemoryRuntime(PROJECT);

    const facts = await collectAll(rt, '', defaultConfig, { route: 'a' });

    expect(facts.heads.map((h) => h.route)).toEqual(['/a']);
    expect(facts.images.map((i) => i.route)).toEqual(['/a']);
    expect(facts.headings.map((h) => h.route)).toEqual(['/a']);
    // File-scoped facts have no route attribution, so a route-filtered run skips them.
    expect(facts.components).toEqual([]);
    expect(facts.kitModules).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter svelte-vitals exec vitest run test/collect-all.test.ts`
Expected: FAIL — `Failed to resolve import "../src/collect-all.js"`.

- [ ] **Step 3: Create `collect-all.ts`**

Create `packages/cli/src/collect-all.ts`. The body is moved verbatim from `analyzeProject` (`index.ts:206-217`), preserving statement order exactly so this stays a pure move:

```ts
import {
  collectKitModuleFacts,
  type ComponentFacts,
  type Config,
  type KitModuleFacts,
  type Project,
  type ResolvedHead,
  type ResolvedHeadings,
  type ResolvedImages,
  type Runtime
} from '@svelte-vitals/core';
import { collectComponentFacts } from './providers/source/components.js';
import { collectProjectFacts } from './providers/source/project.js';
import type { ParseCache } from './providers/source/resolve.js';
import { collectRoutes } from './providers/source/routes.js';
import { routeMatcher } from './route-matcher.js';

/** Everything the rule engine needs about a project, gathered through the Runtime. */
export interface CollectedFacts {
  heads: ResolvedHead[];
  images: ResolvedImages[];
  headings: ResolvedHeadings[];
  project: Project;
  components: ComponentFacts[];
  kitModules: KitModuleFacts[];
}

export interface CollectAllOptions {
  /** Restrict route-scoped facts to routes matching this glob. */
  route?: string;
  /** Reuse a parse cache across calls (the vite dev dashboard passes a long-lived one). */
  parseCache?: ParseCache;
}

/**
 * The whole I/O phase of an analysis: every Runtime call made to gather rule input
 * goes through here. Validation (`detectProject`, `checkVersionFloor`) deliberately
 * stays in `analyzeProject` — it has its own error semantics (ProjectError → exit 2)
 * and is per-run, not per-file.
 *
 * Kept as one function so `test/io-budget.test.ts` can hold the REAL pipeline to a
 * fixed I/O budget: a collector added here falls under that budget automatically,
 * with no test change. See docs/superpowers/specs/2026-07-29-io-budget-ci-design.md.
 */
export async function collectAll(
  rt: Runtime,
  cwd: string,
  config: Config,
  opts: CollectAllOptions = {}
): Promise<CollectedFacts> {
  const matches = routeMatcher(opts.route);
  const collected = await collectRoutes(rt, cwd, config, opts.parseCache);
  const heads = collected.heads.filter((h) => matches(h.route));
  const images = collected.images.filter((i) => matches(i.route));
  const headings = collected.headings.filter((h) => matches(h.route));
  const project = await collectProjectFacts(rt, cwd);
  // Component (Correctness) facts are file-scoped with no route attribution yet, so a
  // route-filtered run skips them rather than reporting unrelated components (#68 review);
  // kitModules is skipped for the same reason.
  const components = opts.route ? [] : await collectComponentFacts(rt, cwd);
  const kitModules = opts.route ? [] : await collectKitModuleFacts(rt, cwd);
  return { heads, images, headings, project, components, kitModules };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter svelte-vitals exec vitest run test/collect-all.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Rewire `analyzeProject` to use it**

In `packages/cli/src/index.ts`, replace lines 206-217 (from `const matches = routeMatcher(opts.route);` through the `kitModules` line) with:

```ts
const { heads, images, headings, project, components, kitModules } = await collectAll(rt, cwd, config, {
  route: opts.route,
  parseCache: opts.parseCache
});
```

Then fix the imports:

- Remove `collectKitModuleFacts,` from the `@svelte-vitals/core` import block (line 20).
- Remove `import { collectRoutes } from './providers/source/routes.js';` (line 28).
- Remove `import { collectComponentFacts } from './providers/source/components.js';` (line 30).
- On line 31, drop `collectProjectFacts` but keep the rest: `import { detectProject, ProjectError, checkVersionFloor } from './providers/source/project.js';`
- Add: `import { collectAll } from './collect-all.js';`
- Keep `import type { ParseCache } from './providers/source/resolve.js';` — it is still used by `AnalyzeOptions.parseCache` (line 165) and the re-export on line 545.

Do NOT add `collect-all.js` to the re-export block; it stays internal.

- [ ] **Step 6: Run the whole suite to prove the move changed no behaviour**

Run: `pnpm --filter svelte-vitals exec vitest run`
Expected: PASS. `analyze-project.test.ts`, `run.test.ts`, `run-diff.test.ts` and the rest must be green — this was a pure move, so any failure is a bug in the extraction, not a test to update.

- [ ] **Step 7: Typecheck, lint, format**

Run: `pnpm typecheck && pnpm format && pnpm lint`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/collect-all.ts packages/cli/src/index.ts packages/cli/test/collect-all.test.ts
git commit -m "refactor(cli): extract the analysis collection phase into collectAll"
```

---

### Task 3: Add the counting Runtime helper

**Files:**

- Create: `packages/cli/test/helpers/counting-runtime.ts`
- Modify: `packages/cli/test/parse-cache.test.ts` (replace its local `withReadSpy`)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `createCountingRuntime(base: Runtime): { rt: Runtime; counts: RuntimeCounts }` where `RuntimeCounts` is `{ readFile: Map<string, number>; exists: Map<string, number>; glob: Map<string, number> }`. Tasks 4 and 5 use both names.

The helper's correctness is proven by `parse-cache.test.ts`, which asserts exact read counts — if the wrapper miscounts, those assertions fail. No separate self-test is needed.

- [ ] **Step 1: Create the helper**

Create `packages/cli/test/helpers/counting-runtime.ts`:

```ts
import type { Runtime } from '@svelte-vitals/core';

/** Call counts keyed by path (readFile/exists) or by pattern (glob). */
export interface RuntimeCounts {
  readFile: Map<string, number>;
  exists: Map<string, number>;
  glob: Map<string, number>;
}

/**
 * Wrap a Runtime so every call through it is counted. These counts are what
 * `test/io-budget.test.ts` holds the analysis pipeline to: unlike wall-clock
 * timings they are identical on every machine, so the gate cannot be flaky.
 * See docs/superpowers/specs/2026-07-29-io-budget-ci-design.md.
 */
export function createCountingRuntime(base: Runtime): { rt: Runtime; counts: RuntimeCounts } {
  const counts: RuntimeCounts = { readFile: new Map(), exists: new Map(), glob: new Map() };
  const bump = (m: Map<string, number>, key: string) => m.set(key, (m.get(key) ?? 0) + 1);
  return {
    counts,
    rt: {
      ...base,
      readFile(path) {
        bump(counts.readFile, path);
        return base.readFile(path);
      },
      exists(path) {
        bump(counts.exists, path);
        return base.exists(path);
      },
      glob(pattern, cwd) {
        bump(counts.glob, pattern);
        return base.glob(pattern, cwd);
      }
    }
  };
}
```

- [ ] **Step 2: Switch `parse-cache.test.ts` to the shared helper**

In `packages/cli/test/parse-cache.test.ts`:

Delete the local `withReadSpy` function (lines 6-20, the block starting `/** Wraps a Runtime's readFile to count calls per path...`) and the now-unused `import type { Runtime } from '@svelte-vitals/core';` on line 2.

Add the import next to the existing `createMemoryRuntime` import:

```ts
import { createCountingRuntime } from './helpers/counting-runtime.js';
```

Change the call site from:

```ts
const { rt, counts } = withReadSpy(base);
```

to:

```ts
const { rt, counts } = createCountingRuntime(base);
```

Then update the four assertions to read from the `readFile` map:

```ts
expect(counts.readFile.get('src/routes/+layout.svelte')).toBe(1);
expect(counts.readFile.get('src/lib/Seo.svelte')).toBe(1);
expect(counts.readFile.get('src/routes/a/+page.svelte')).toBe(1);
expect(counts.readFile.get('src/routes/b/+page.svelte')).toBe(1);
```

- [ ] **Step 3: Run the test to verify the helper counts correctly**

Run: `pnpm --filter svelte-vitals exec vitest run test/parse-cache.test.ts`
Expected: PASS. The exact-count assertions are the helper's proof.

- [ ] **Step 4: Typecheck, lint, format**

Run: `pnpm typecheck && pnpm format && pnpm lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/test/helpers/counting-runtime.ts packages/cli/test/parse-cache.test.ts
git commit -m "test(cli): add a shared counting Runtime helper"
```

---

### Task 4: Budget invariants 1 and 2 (per-file reads, per-pattern globs)

**Files:**

- Create: `packages/cli/test/io-budget.test.ts`

**Interfaces:**

- Consumes: `collectAll` / `CollectAllOptions` from `../src/collect-all.js` (Task 2), `createCountingRuntime` from `./helpers/counting-runtime.js` (Task 3), `createMemoryRuntime` from `./helpers/memory-runtime.js` (existing).
- Produces: the `project(routeCount)` fixture builder, used again in Task 5 from the same file.

A guard test starts green, so the TDD cycle here is inverted: write it, watch it pass, then deliberately break the behaviour it guards and confirm it goes red with a useful message. A guard that has never been seen failing is not a guard.

- [ ] **Step 1: Write the budget test**

Create `packages/cli/test/io-budget.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { defaultConfig } from '@svelte-vitals/core';
import { collectAll } from '../src/collect-all.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';
import { createCountingRuntime } from './helpers/counting-runtime.js';

/**
 * Reads per file allowed across one full collection phase. TWO is the measured
 * status quo, not an ideal. Two independent paths sit at exactly this cap:
 *
 *   - every `.svelte` file: `collectRoutes` reads it for head resolution
 *     (parseFile) and `collectComponentFacts` reads it again for component facts
 *     (parseComponentFacts) — different parsers, separate caches, and the
 *     component glob also matches route files.
 *   - the Vite config: `collectProjectFacts` reads it once via
 *     `detectViteMinifyDisabled` and once via `detectKitPathsBase`.
 *
 * Lowering this number is welcome and should accompany any unification of those
 * read paths. RAISING it is a design decision that needs a recorded reason — not a
 * number edit. See docs/superpowers/specs/2026-07-29-io-budget-ci-design.md.
 */
const MAX_READS_PER_FILE = 2;

/**
 * A SvelteKit-shaped project as a path→source map: `routeCount` pages that all
 * inherit one root layout, which itself pulls in one shared $lib component. The
 * sharing is the point — it is what a broken parse cache would read repeatedly.
 */
function project(routeCount: number): Record<string, string> {
  const files: Record<string, string> = {
    'svelte.config.js': `export default { kit: {} };\n`,
    'vite.config.ts': `export default { plugins: [] };\n`,
    'src/app.html': `<!doctype html><html lang="en"><body></body></html>\n`,
    'src/routes/+layout.svelte': `<script>\n  import Card from '$lib/Card.svelte';\n  let { children } = $props();\n</script>\n\n<Card title="shared" />\n{@render children()}\n`,
    'src/lib/Card.svelte': `<script>\n  let { title = '' } = $props();\n</script>\n\n<svelte:head><meta name="description" content="shared" /></svelte:head>\n<h3>{title}</h3>\n`
  };
  for (let i = 0; i < routeCount; i++) {
    files[`src/routes/p${i}/+page.svelte`] =
      `<svelte:head><title>Page ${i}</title></svelte:head>\n<h1>Page ${i}</h1>\n`;
  }
  return files;
}

describe('I/O budget for the collection phase', () => {
  it(`reads no file more than ${MAX_READS_PER_FILE} times`, async () => {
    const { rt, counts } = createCountingRuntime(createMemoryRuntime(project(6)));

    await collectAll(rt, '', defaultConfig);

    // Collect the offenders rather than asserting per entry, so a failure names
    // every file that blew the budget and by how much.
    const over = [...counts.readFile].filter(([, n]) => n > MAX_READS_PER_FILE);
    expect(over).toEqual([]);
  });

  it('issues each glob pattern exactly once', async () => {
    const { rt, counts } = createCountingRuntime(createMemoryRuntime(project(6)));

    await collectAll(rt, '', defaultConfig);

    // A second call for the same pattern is a second full directory traversal.
    const repeated = [...counts.glob].filter(([, n]) => n !== 1);
    expect(repeated).toEqual([]);
    // Sanity: the run really did glob (an empty map would pass the check above).
    expect(counts.glob.size).toBeGreaterThan(0);
  });
});
```

Note on comments: never write a glob containing `**/` inside a `/** */` block comment — the `*/` terminates the comment. The `MAX_READS_PER_FILE` doc block above is worded to avoid this; keep it that way. Inside `//` line comments and string literals the glob is fine as-is.

- [ ] **Step 2: Run it and confirm it passes on current code**

Run: `pnpm --filter svelte-vitals exec vitest run test/io-budget.test.ts`
Expected: PASS (2 tests).

Two files are expected to sit exactly at the cap of 2 (`.svelte` files, and `vite.config.ts` — see the `MAX_READS_PER_FILE` comment), so the test is green but with no headroom. If it instead FAILS, some file is read three or more times: record which file and why in the test comment, and treat it as a finding to report rather than a reason to raise the constant.

- [ ] **Step 3: Break the parse cache and confirm invariant 1 catches it**

In `packages/cli/src/providers/source/resolve.ts`, temporarily change the first line of `readAndParse`'s body from:

```ts
let hit = cache.get(rel);
```

to:

```ts
let hit = undefined; // TEMPORARY: cache bypass, to prove the budget test bites
```

Run: `pnpm --filter svelte-vitals exec vitest run test/io-budget.test.ts`
Expected: FAIL on the first test, with the shared files listed — `src/routes/+layout.svelte` and `src/lib/Card.svelte` read once per route instead of once. Confirm the failure output actually names them; that readability is the point of the `over` array.

- [ ] **Step 4: Revert the break**

Restore the line to `let hit = cache.get(rel);`.

Run: `git diff packages/cli/src/providers/source/resolve.ts`
Expected: empty output — the file is back to its committed state.

- [ ] **Step 5: Break the glob count and confirm invariant 2 catches it**

In `packages/cli/src/collect-all.ts`, temporarily add a duplicate call right after the `kitModules` line:

```ts
await collectComponentFacts(rt, cwd); // TEMPORARY: prove the glob budget bites
```

Run: `pnpm --filter svelte-vitals exec vitest run test/io-budget.test.ts`
Expected: FAIL on both tests — `src/**/*.svelte{,.ts,.js}` globbed twice, and every `.svelte` read three times.

- [ ] **Step 6: Revert the break and confirm green**

Remove the temporary line.

Run: `git diff packages/cli/src/collect-all.ts && pnpm --filter svelte-vitals exec vitest run test/io-budget.test.ts`
Expected: empty diff, then PASS (2 tests).

- [ ] **Step 7: Typecheck, lint, format**

Run: `pnpm typecheck && pnpm format && pnpm lint`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/test/io-budget.test.ts
git commit -m "test(cli): guard per-file read and per-pattern glob budgets"
```

---

### Task 5: Budget invariants 3 and 4 (cache scaling, route fast path)

**Files:**

- Modify: `packages/cli/test/io-budget.test.ts` (add two tests to the existing `describe`)

**Interfaces:**

- Consumes: `project(routeCount)`, `MAX_READS_PER_FILE`, `collectAll`, `createCountingRuntime`, `createMemoryRuntime` — all already in the file from Task 4.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the two tests**

Append inside the existing `describe('I/O budget for the collection phase', ...)` block in `packages/cli/test/io-budget.test.ts`:

```ts
it('does not read shared files more often as route count grows', async () => {
  const small = createCountingRuntime(createMemoryRuntime(project(2)));
  const large = createCountingRuntime(createMemoryRuntime(project(12)));

  await collectAll(small.rt, '', defaultConfig);
  await collectAll(large.rt, '', defaultConfig);

  // 6x the routes must not mean more reads of the files they share. This is the
  // primary parse-cache-breakage detector: per-file budgets alone stay green if
  // the cache dies but every file happens to stay under the cap.
  for (const shared of ['src/routes/+layout.svelte', 'src/lib/Card.svelte']) {
    expect([shared, large.counts.readFile.get(shared)]).toEqual([shared, small.counts.readFile.get(shared)]);
  }
});

it('scans no components or kit modules for a route-filtered run', async () => {
  const { rt, counts } = createCountingRuntime(createMemoryRuntime(project(6)));

  await collectAll(rt, '', defaultConfig, { route: 'p0' });

  // File-scoped facts are skipped when a single route was asked for; issuing
  // their globs anyway would pay for a whole-project scan nobody reads.
  const patterns = [...counts.glob.keys()];
  expect(patterns).not.toContain('src/**/*.svelte{,.ts,.js}');
  expect(patterns.filter((p) => p.includes('+{page,layout}') || p.includes('hooks.server'))).toEqual([]);
});
```

The `[shared, count]` tuple form is deliberate: a bare count comparison fails with `expected 6 to be 1`, which does not say _which_ file regressed.

- [ ] **Step 2: Run and confirm both pass**

Run: `pnpm --filter svelte-vitals exec vitest run test/io-budget.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 3: Break the cache and confirm invariant 3 catches it**

Apply the same temporary edit as Task 4 Step 3 — in `packages/cli/src/providers/source/resolve.ts`, change `let hit = cache.get(rel);` to `let hit = undefined;`.

Run: `pnpm --filter svelte-vitals exec vitest run test/io-budget.test.ts`
Expected: FAIL on the scaling test, showing `['src/routes/+layout.svelte', 12]` against `['src/routes/+layout.svelte', 2]`.

- [ ] **Step 4: Revert and break the fast path instead**

Restore `let hit = cache.get(rel);` in `resolve.ts`. Then in `packages/cli/src/collect-all.ts`, temporarily change:

```ts
const components = opts.route ? [] : await collectComponentFacts(rt, cwd);
```

to:

```ts
const components = await collectComponentFacts(rt, cwd); // TEMPORARY
```

Run: `pnpm --filter svelte-vitals exec vitest run test/io-budget.test.ts`
Expected: FAIL on the route-filtered test — `src/**/*.svelte{,.ts,.js}` is now in the pattern list.

- [ ] **Step 5: Revert both breaks and confirm green**

Restore the `opts.route ? [] :` guard.

Run: `git diff packages/cli/src && pnpm --filter svelte-vitals exec vitest run`
Expected: empty diff, then the full CLI suite passes.

- [ ] **Step 6: Typecheck, lint, format**

Run: `pnpm typecheck && pnpm format && pnpm lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/test/io-budget.test.ts
git commit -m "test(cli): guard parse-cache scaling and the route-filtered fast path"
```

---

### Task 6: Promote the timing benchmark and document the budget

The benchmark answers what counts cannot: a widened analysis (more AST walking for the same I/O) and lost parallelism. It stays out of CI because shared-runner noise makes its numbers uncomparable, but it must stop describing itself as disposable.

**Files:**

- Modify: `packages/vite/package.json` (scripts)
- Modify: `package.json` (root scripts)
- Modify: `packages/vite/scripts/bench/bench.mjs:1-5` (header)
- Modify: `packages/vite/scripts/bench/gen-project.mjs:1-5` (header)
- Modify: `AGENTS.md` (Conventions section)

**Interfaces:**

- Consumes: nothing.
- Produces: `pnpm bench`.

- [ ] **Step 1: Register the script in the vite package**

In `packages/vite/package.json`, add to `scripts` (after `"build"`):

```json
    "bench": "node scripts/bench/bench.mjs",
```

- [ ] **Step 2: Register the root passthrough**

In the root `package.json`, add to `scripts` after `"test"`:

```json
    "bench": "pnpm --filter @svelte-vitals/vite run bench",
```

- [ ] **Step 3: Rewrite the `bench.mjs` header**

Replace lines 1-5 of `packages/vite/scripts/bench/bench.mjs` (everything from `// Throwaway benchmark for Plan 037` down to and including the line ending `dev-server-analysis-isolation-design.md.`) with:

```js
// Manual timing benchmark for the whole-project analysis path — the same
// `analyzeProject()` call packages/vite/src/ui/analysis.ts's `runOnce` makes on
// every dev-server save. Run it with `pnpm bench`.
//
// CI deliberately does NOT run this. Shared GitHub runners vary by 1.5-2x under
// neighbour load, so absolute timings are not comparable across runs; the speed
// regression gate CI *does* run is the deterministic I/O budget in
// packages/cli/test/io-budget.test.ts. Reach for this benchmark for the two things
// call counts cannot catch: a widened analysis (more AST walking for the same I/O)
// and lost parallelism. See
// docs/superpowers/specs/2026-07-29-io-budget-ci-design.md.
//
// Not part of the shipped package — do not import from packages/vite/src.
```

Leave the `// Measures, for synthetic SvelteKit-like projects...` paragraph and everything below it untouched.

- [ ] **Step 4: Rewrite the `gen-project.mjs` header**

Replace lines 1-5 of `packages/vite/scripts/bench/gen-project.mjs` (from `// Throwaway benchmark fixture generator` through the line ending `dev-server-analysis-isolation-design.md).`) with:

```js
// Fixture generator for the manual timing benchmark (`pnpm bench`, bench.mjs).
// Not part of the shipped package — never imported from packages/vite/src.
```

Leave the `// Generates a synthetic SvelteKit-like project with N pages...` paragraph and everything below it untouched.

- [ ] **Step 5: Verify `pnpm bench` runs**

Run: `pnpm build && pnpm bench --sizes=50 --runs=1`
Expected: a line like `routes=50 run=1/1 total=<n>ms ... results=1465`, then a `--- JSON ---` block. The `results=1465` figure should match; a different finding count means rules changed since the spec was written, which is fine — the timing is what matters here.

- [ ] **Step 6: Document the budget in `AGENTS.md`**

In `AGENTS.md`, in the `## Conventions` section, add this bullet immediately after the existing `- **Tests**: vitest, per-package \`test/\` directories; fixtures live under \`test/fixtures/\`.` bullet:

```markdown
- **I/O budget**: `packages/cli/test/io-budget.test.ts` holds the collection phase
  (`packages/cli/src/collect-all.ts`) to a fixed number of `Runtime` calls. This is how
  analysis speed is defended in CI — wall-clock timings are far too noisy on shared
  runners to gate on. Adding a collector or a glob means checking that test. Lowering a
  budget is welcome; raising one is a design decision needing a recorded reason, not a
  number edit. The two regressions counts cannot catch — a widened analysis, and lost
  parallelism — are measured manually with `pnpm bench` (never in CI).
```

- [ ] **Step 7: Full verification**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/vite/package.json package.json packages/vite/scripts/bench/bench.mjs packages/vite/scripts/bench/gen-project.mjs AGENTS.md
git commit -m "chore(vite): promote the timing benchmark to a documented manual tool"
```

---

## Final verification

- [ ] Run the full verify set from a clean tree: `pnpm format && pnpm lint && pnpm typecheck && pnpm build && pnpm test`
- [ ] Confirm `git diff main --stat` shows only: 3 new source/test helper files, 1 new test file, and edits to `index.ts`, `parse-cache.test.ts`, both `package.json`s, both bench scripts, and `AGENTS.md`.
- [ ] Confirm `packages/cli/src/index.ts` does NOT re-export `collect-all.js` (public API unchanged), while `routeMatcher` IS still exported from it.
- [ ] No changeset file was added.
