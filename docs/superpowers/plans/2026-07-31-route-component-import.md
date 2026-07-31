# architecture/route-component-import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Report a component that imports a SvelteKit route entry (`+page.svelte`, `+layout.svelte`,
`+error.svelte`), because Kit renders those with data it supplies and an import gets none of it.

**Architecture:** A `componentRule` over `ComponentFacts.importSpans`. Each span's specifier is resolved
with `resolveRepoLocalPath` (which since #330 follows the project's declared aliases), and a resolved path
under the routes directory whose basename is a route-entry name is reported. Two supporting changes make
that possible: `importSpans` gains a flag for imports that produce no runtime binding, and `componentRule`
starts handing `applies`/`bad` the `RuleContext` — which its sibling `kitModuleRule` already does — so the
rule can reach `ctx.project.kitAliases`.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), vitest, estree walking via the repo's
`component-parse` helpers, oxlint + oxfmt, Astro Starlight for docs.

**Spec:** `docs/superpowers/specs/2026-07-30-route-component-import-design.md` — read it before Task 1.

## Global Constraints

- **Core purity:** `packages/core/src/` must contain no `node:` imports, no I/O, and no runtime-specific
  globals. All I/O is injected through the `Runtime` interface.
- **This is the first Architecture rule that is on by default**, so a design error reaches every user
  rather than only those who configured something. It lands at `severity: 'info'` — the landing severity
  every new rule takes; promotion happens only in a major.
- **A `string-list` option ADDS to its built-in default and can never shrink it.** That asymmetry is why
  `exemptImporters`' default is deliberately narrow: a too-narrow default fails with a false positive the
  user can fix by appending; a too-broad one fails with a missed true positive they cannot fix at all.
- **`componentRule`'s `applies` means "does this file carry the signal at all"** — false emits nothing,
  neither a penalty nor a seeded pass. Exemption belongs in `bad`, not `applies`, so an exempt file gets a
  **pass** rather than silence.
- **Registering a rule touches four places**, and TypeScript catches only three: the import, the
  `allRules` array and the re-export block in `packages/core/src/rules/index.ts`, plus the duplicated
  `export { … } from './rules/index.js'` list in `packages/core/src/index.ts`. Grep for the previous
  rule's exported name after adding the new one.
- **Rule docs are load-bearing:** `packages/cli/test/docs-links.test.ts` fails if either language's page
  is missing, and `packages/cli/test/rules-index.test.mjs` fails if the generated index pages are stale.
- **Never hard-code rule counts or ID ranges** in READMEs or guides — refer to rule categories instead.
- **en/ja docs ship together**; write real, idiomatic Japanese.
- **Never name other tools** (linters, plugins, competing products) in code, docs, commits, or the PR.
- **A changeset is required** (`pnpm changeset`): this adds a default-on rule.
- **`Object.hasOwn(obj, key)`** for presence checks on open-ended records — never `key in obj` or
  `obj[key] !== undefined`.
- **Verify commands:** per-package `node_modules/.bin/{vitest,tsc,oxlint,oxfmt}`. A full-workspace `pnpm`
  command fails in this sandbox for a pre-existing reason unrelated to this work (the `docs` package has
  no installed dependencies, so the docs site cannot be built locally — CI's `docs` job is that gate).
- **Conventional commits, scoped by package:** `feat(core):`, `test(core):`, `docs:`.

## File Structure

| File                                                                         | Responsibility                          | Task |
| ---------------------------------------------------------------------------- | --------------------------------------- | ---- |
| `packages/core/src/component.ts`                                             | `importSpans` gains `type?: true`       | 1    |
| `packages/core/src/component-parse.ts`                                       | Set that flag in `collectImportSources` | 1    |
| `packages/core/src/rules/component-rule.ts`                                  | Hand `applies`/`bad` the `RuleContext`  | 2    |
| `packages/core/src/rules/architecture/route-component-import.ts`             | The rule                                | 2    |
| `packages/core/src/rules/index.ts`, `packages/core/src/index.ts`             | The four registration sites             | 3    |
| `docs/src/content/docs/rules/architecture/route-component-import.md` + `ja/` | Rule pages                              | 3    |
| `docs/src/content/docs/rules/**/index.mdx`                                   | Regenerated, not hand-edited            | 3    |
| `.changeset/route-component-import.md`                                       | Release note                            | 3    |

Tests: `packages/core/test/component-parse.test.ts` (Task 1),
`packages/core/test/route-component-import.test.ts` (new, Task 2),
`packages/cli/test/docs-links.test.ts` and `rules-index.test.mjs` (Task 3, already written — they must
pass, not be edited).

---

### Task 1: `importSpans` records an import that produces no runtime binding

The rule must not report a type-only import: it is erased at build, nothing renders, and the harm the
rule describes cannot occur. The fact set does not currently distinguish it.

**Files:**

- Modify: `packages/core/src/component.ts:112` (the `importSpans` field)
- Modify: `packages/core/src/component-parse.ts:1251-1258` (`collectImportSources`)
- Test: `packages/core/test/component-parse.test.ts` (append a `describe` block)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `importSpans: { source: string; line: number; type?: true }[]` on `ComponentFacts`.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/test/component-parse.test.ts`, following that file's existing helper style:

```ts
describe('parseComponentFacts — type-only imports in importSpans', () => {
  const spans = (src: string) => parseComponentFacts(src, 'src/routes/a/+page.svelte').importSpans;

  it('marks a declaration-level type import', () => {
    expect(spans(`<script lang="ts">import type P from './+page.svelte';</script>`)).toEqual([
      { source: './+page.svelte', line: 1, type: true }
    ]);
  });

  it('marks a declaration whose every specifier is inline-typed', () => {
    expect(spans(`<script lang="ts">import { type A, type B } from './x.js';</script>`)).toEqual([
      { source: './x.js', line: 1, type: true }
    ]);
  });

  it('leaves a value import unmarked', () => {
    expect(spans(`<script>import X from './X.svelte';</script>`)).toEqual([{ source: './X.svelte', line: 1 }]);
  });

  it('leaves a mixed value/type declaration unmarked', () => {
    expect(spans(`<script lang="ts">import X, { type A } from './X.svelte';</script>`)).toEqual([
      { source: './X.svelte', line: 1 }
    ]);
  });

  it('leaves a side-effect import unmarked', () => {
    // No specifiers at all is NOT a type import — the module is loaded for its side effects.
    expect(spans(`<script>import './setup.js';</script>`)).toEqual([{ source: './setup.js', line: 1 }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: from `packages/core`, `node_modules/.bin/vitest run component-parse`
Expected: FAIL — every span comes back without a `type` key, so the four marked cases mismatch.

- [ ] **Step 3: Implement**

In `packages/core/src/component.ts`, replace the `importSpans` field and its comment:

```ts
  /**
   * Module specifiers of every `import`, each with its source line (performance/heavy-import,
   * architecture/route-component-import). `type` marks a declaration that contributes **no runtime
   * value binding** — either `import type …`, or one whose every specifier is inline-typed
   * (`import { type A } from …`). A specifier-less side-effect import is not marked: it still loads
   * the module. Optional, so existing external constructors of `ComponentFacts` are unaffected.
   */
  importSpans: { source: string; line: number; type?: true }[];
```

In `packages/core/src/component-parse.ts`, replace `collectImportSources`:

```ts
/** Whether an import declaration contributes no runtime value binding — see `ComponentFacts.importSpans`. */
function isTypeOnlyImport(n: Node): boolean {
  if (n.importKind === 'type') return true;
  const specs = n.specifiers;
  // A declaration with no specifiers is a side-effect import: the module is still loaded.
  return Array.isArray(specs) && specs.length > 0 && specs.every((s: Node) => s?.importKind === 'type');
}

/** Module specifiers of every `import`, each with its source line (see `ComponentFacts.importSpans`). */
function collectImportSources(
  program: Node,
  source: string,
  acc: { source: string; line: number; type?: true }[]
): void {
  walkEstree(program, (n) => {
    if (n.type === 'ImportDeclaration' && typeof n.source?.value === 'string') {
      acc.push({
        source: n.source.value,
        line: lineOf(source, n.start),
        ...(isTypeOnlyImport(n) ? { type: true as const } : {})
      });
    }
  });
}
```

Update the two `const importSpans: { source: string; line: number }[] = []` declarations in the same file
(around lines 1971 and in `parseModuleFacts`'s literal) to the widened element type.

- [ ] **Step 4: Run the test to verify it passes**

Run: from `packages/core`, `node_modules/.bin/vitest run component-parse`
Expected: PASS.

- [ ] **Step 5: Prove the extension is backwards compatible**

Run the whole core suite: from `packages/core`, `node_modules/.bin/vitest run`
Expected: PASS, with the `performance/heavy-import` and `architecture/private-scope-import` suites
**unedited**. Both read `importSpans` and ignore the new key; if either needed a change, stop and report
— an added optional field must not alter their behaviour.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
node_modules/.bin/tsc --noEmit -p packages/core/tsconfig.json
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
git add packages/core/src/component.ts packages/core/src/component-parse.ts packages/core/test/component-parse.test.ts
git commit -m "feat(core): record which imports produce no runtime binding"
```

---

### Task 2: The rule, and the harness change it needs

**Files:**

- Modify: `packages/core/src/rules/component-rule.ts` (the `applies`/`bad` signatures and their two call
  sites inside `check`)
- Create: `packages/core/src/rules/architecture/route-component-import.ts`
- Test: `packages/core/test/route-component-import.test.ts` (new)

**Interfaces:**

- Consumes: `importSpans[].type` (Task 1);
  `resolveRepoLocalPath(spec: string, importerFile: string, aliases?: readonly KitAlias[]): string | undefined`
  from `packages/core/src/kit-module-parse.js`; `routeGlobToRegExp(pattern: string): RegExp` from
  `packages/core/src/config-apply.js`; `listOption(options: RuleOptions, key: string): string[]` from
  `packages/core/src/rule-options.js`.
- Produces: `architectureRouteComponentImport`, a `Rule`, exported from the new file. Task 3 registers it.
  Also: `componentRule`'s `applies`/`bad` now take a third `ctx: RuleContext` argument.

- [ ] **Step 1: Give `componentRule` the context, as its sibling harness already has**

`componentRule`'s callbacks take `(c, o)` and cannot reach `ctx.project.kitAliases`, which this rule needs
to resolve a specifier. `kitModuleRule` in the same directory already declares
`applies: (m, ctx) => …` / `bad: (m, ctx) => …`, so this is bringing the two harnesses into line rather
than inventing a mechanism. The change is **purely additive** — every existing `componentRule` user
declares fewer parameters and is unaffected.

In `packages/core/src/rules/component-rule.ts`, add `import type { RuleContext }` to the existing
`from '../rule.js'` type import if it is not already there, and change the two option fields:

```ts
  /** Whether this component carries the signal at all (no signal → emit nothing for the file). */
  applies: (c: ComponentFacts, o: RuleOptions, ctx: RuleContext) => boolean;
  /** The offending occurrences in a component (empty → the file passes). */
  bad: (c: ComponentFacts, o: RuleOptions, ctx: RuleContext) => ComponentIssue[];
```

and their two call sites inside `check`:

```ts
if (!opts.applies(c, o, ctx)) continue; // no signal in this file → neither penalize nor seed
const bad = opts.bad(c, o, ctx).filter((b) => !(b.line > 0 && isSuppressed(c, opts.id, b.line)));
```

- [ ] **Step 2: Run the core suite to confirm nothing else moved**

Run: from `packages/core`, `node_modules/.bin/vitest run`
Expected: PASS, unedited. Every existing `componentRule`-based rule ignores the new argument.

- [ ] **Step 3: Write the failing rule tests**

Create `packages/core/test/route-component-import.test.ts`. Build contexts by hand in the style of
`packages/core/test/security-kit-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { architectureRouteComponentImport } from '../src/rules/architecture/route-component-import.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { ComponentFacts } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/types.js';

const config = defineConfig({});
const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const passes = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'own');

const comp = (file: string, spans: ComponentFacts['importSpans']): ComponentFacts =>
  ({ file, importSpans: spans, imports: spans.map((s) => s.source), suppressions: [] }) as unknown as ComponentFacts;

const ctx = (components: ComponentFacts[], over: Partial<RuleContext> = {}): RuleContext =>
  ({ heads: [], project: defaultProject, config, components, ...over }) as RuleContext;

const IMPORTER = 'src/lib/Panel.svelte';
const run = (spans: ComponentFacts['importSpans'], file = IMPORTER, over: Partial<RuleContext> = {}) =>
  architectureRouteComponentImport.check(ctx([comp(file, spans)], over));

describe('architecture/route-component-import — the mechanism', () => {
  it('flags each route-entry filename Kit defines', async () => {
    for (const name of ['+page.svelte', '+layout.svelte', '+error.svelte']) {
      const rs = await run([{ source: `../routes/a/${name}`, line: 3 }]);
      expect(fails(rs), name).toHaveLength(1);
      expect(fails(rs)[0]!.line).toBe(3);
    }
  });

  it('flags an @ breakout entry, including a dotted layout name', async () => {
    // Kit strips only the extension before matching `@(.*)`, so a dotted breakout name is a real
    // route entry — see the design doc.
    for (const name of ['+page@.svelte', '+layout@foo.svelte', '+page@foo.bar.svelte']) {
      expect(fails(await run([{ source: `../routes/a/${name}`, line: 1 }])), name).toHaveLength(1);
    }
  });

  it('ignores a route-entry name outside the routes directory', async () => {
    // Kit gives these names meaning only under src/routes.
    expect(fails(await run([{ source: '../widgets/+page.svelte', line: 1 }]))).toEqual([]);
  });

  it('ignores a bare package and an unresolvable specifier', async () => {
    expect(fails(await run([{ source: 'some-pkg', line: 1 }]))).toEqual([]);
  });

  it('resolves through a declared alias', async () => {
    const project = {
      ...defaultProject,
      kitAliases: [
        { find: '$lib', replacement: 'src/lib', match: 'prefix' as const },
        { find: '$r', replacement: 'src/routes', match: 'prefix' as const }
      ]
    };
    expect(fails(await run([{ source: '$r/a/+page.svelte', line: 2 }], IMPORTER, { project }))).toHaveLength(1);
  });

  it('skips an import that produces no runtime binding', async () => {
    expect(fails(await run([{ source: '../routes/a/+page.svelte', line: 1, type: true }]))).toEqual([]);
  });

  it('emits nothing at all for a file importing no route entry', async () => {
    // Neither a penalty nor a seeded pass: no signal in the file.
    expect(await run([{ source: './Button.svelte', line: 1 }])).toEqual([]);
  });
});

describe('architecture/route-component-import — exemptions', () => {
  const span = [{ source: '../routes/a/+page.svelte', line: 1 }];

  it('exempts each built-in importer pattern', async () => {
    for (const file of ['src/lib/A.stories.svelte', 'src/lib/A.test.svelte', 'src/lib/A.spec.svelte']) {
      expect(fails(await run(span, file)), file).toEqual([]);
    }
  });

  it('exempts a suffixed satellite name, since * is a within-segment wildcard', async () => {
    expect(fails(await run(span, 'src/lib/A.error.test.svelte'))).toEqual([]);
  });

  it('gives an exempt importer a PASS, not silence', async () => {
    // Its route-entry imports are fine, which is a true statement worth recording; putting the
    // exemption in `applies` instead would call the file signal-free, which it is not.
    expect(passes(await run(span, 'src/lib/A.test.svelte'))).toHaveLength(1);
  });

  it('exempts a pattern appended through the option', async () => {
    const cfg = defineConfig({
      rules: { 'architecture/route-component-import': { options: { exemptImporters: ['**/*.fixture.svelte'] } } }
    });
    const rs = await architectureRouteComponentImport.check(
      ctx([comp('src/lib/A.fixture.svelte', span)], { config: cfg })
    );
    expect(fails(rs)).toEqual([]);
  });

  it('keeps the built-ins when the option appends to them', async () => {
    // A string-list ADDS to its default; an appended pattern must not replace *.test.svelte.
    const cfg = defineConfig({
      rules: { 'architecture/route-component-import': { options: { exemptImporters: ['**/*.fixture.svelte'] } } }
    });
    const rs = await architectureRouteComponentImport.check(
      ctx([comp('src/lib/A.test.svelte', span)], { config: cfg })
    );
    expect(fails(rs)).toEqual([]);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: from `packages/core`, `node_modules/.bin/vitest run route-component-import`
Expected: FAIL — the module does not exist.

- [ ] **Step 5: Write the rule**

Create `packages/core/src/rules/architecture/route-component-import.ts`:

```ts
import { componentRule } from '../component-rule.js';
import { listOption } from '../../rule-options.js';
import { resolveRepoLocalPath } from '../../kit-module-parse.js';
import { routeGlobToRegExp } from '../../config-apply.js';
import type { ComponentFacts } from '../../component.js';
import type { RuleContext } from '../../rule.js';

const ID = 'architecture/route-component-import';

/**
 * Satellite files that legitimately render a route entry by hand: a story renders it to look at,
 * a test renders it to assert on, and both supply what Kit would have supplied.
 *
 * Deliberately NARROW, because a `string-list` option can only widen it. The two failure
 * directions are not symmetric: too narrow gives a false positive the user fixes by appending;
 * too broad gives a missed true positive they cannot fix at all, since nothing removes an entry.
 * Configuring this is therefore an expected step for a project whose satellite convention is its
 * own, not an exceptional one.
 */
const EXEMPT_IMPORTERS = ['**/*.stories.svelte', '**/*.test.svelte', '**/*.spec.svelte'] as const;

const ROUTES_DIR = 'src/routes/';

/**
 * Kit's own route-entry component names. `analyze()` in
 * `@sveltejs/kit/src/core/sync/create_manifest_data/index.js` strips only the component extension
 * and then tests `/^\+(?:(page(?:@(.*))?)|(layout(?:@(.*))?)|(error))$/`, so the `@` breakout
 * suffix is unbounded — a layout name may contain dots, and `[^./]*` would wrongly miss
 * `+page@foo.bar.svelte`.
 */
const ROUTE_ENTRY = /^\+(page|layout)(@.*)?\.svelte$/;

/** Whether a project-relative path is a route entry. Kit gives these names meaning only under the routes directory. */
function isRouteEntry(path: string): boolean {
  if (!path.startsWith(ROUTES_DIR)) return false;
  const base = path.slice(path.lastIndexOf('/') + 1);
  return base === '+error.svelte' || ROUTE_ENTRY.test(base);
}

/** The route entries this component imports, with the line each import sits on. */
function routeEntryImports(c: ComponentFacts, ctx: RuleContext): { line: number; target: string }[] {
  const out: { line: number; target: string }[] = [];
  for (const { source, line, type } of c.importSpans ?? []) {
    if (type) continue; // erased at build: nothing renders, so the harm cannot occur
    const target = resolveRepoLocalPath(source, c.file, ctx.project.kitAliases);
    if (target !== undefined && isRouteEntry(target)) out.push({ line, target });
  }
  return out;
}

export const architectureRouteComponentImport = componentRule({
  id: ID,
  title: 'Route component import',
  category: 'architecture',
  severity: 'info',
  label: 'Route component imports',
  options: { exemptImporters: { kind: 'string-list', default: EXEMPT_IMPORTERS } },
  recommendation:
    'Extract the shared markup into a component under $lib and import that from both places, leaving the route entry to SvelteKit.',
  rationale:
    'A route entry is written on the assumption that SvelteKit renders it: Kit hands a page its data and params, and an error page its page.error and page.status. Imported from somewhere else it receives none of that and renders against nothing, or against the importing page data standing in for its own.',
  // Signal present = this file imports a route entry, exempt or not. An exempt file therefore
  // reaches `bad` and earns a PASS, rather than being called signal-free.
  applies: (c, o, ctx) => routeEntryImports(c, ctx).length > 0,
  bad: (c, o, ctx) => {
    const exempt = listOption(o, 'exemptImporters').map(routeGlobToRegExp);
    if (exempt.some((re) => re.test(c.file))) return [];
    return routeEntryImports(c, ctx).map(({ line, target }) => ({
      line,
      message: `${target} is a SvelteKit route entry — imported here it renders without the data Kit would give it`
    }));
  }
});
```

`o` is unused in `applies`. oxlint's `no-unused-vars` uses `args: "after-used"`, so a parameter followed
by a used one is fine; if it does complain, rename it `_o` rather than reordering the signature.

- [ ] **Step 6: Run the tests to verify they pass**

Run: from `packages/core`, `node_modules/.bin/vitest run route-component-import`
Expected: PASS.

- [ ] **Step 7: Prove three tests are load-bearing**

Each mutation must break tests; restore after each.

1. Change `ROUTE_ENTRY` to `/^\+(page|layout)(@[^./]*)?\.svelte$/`.
   Expected: the dotted-`@` case FAILS.
2. Delete the `if (type) continue;` line.
   Expected: the no-runtime-binding test FAILS.
3. Move the exemption check from `bad` into `applies` (return `false` when exempt).
   Expected: the "gives an exempt importer a PASS" test FAILS.

- [ ] **Step 8: Run the full core suite, typecheck, lint, commit**

```bash
node_modules/.bin/tsc --noEmit -p packages/core/tsconfig.json
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
git add packages/core/src/rules packages/core/test/route-component-import.test.ts
git commit -m "feat(core): add architecture/route-component-import"
```

---

### Task 3: Register, document, and release

The rule exists but nothing selects it, no docs page describes it, and no release note mentions it. Two
CI tests already exist to catch the first two — they must pass, not be edited.

**Files:**

- Modify: `packages/core/src/rules/index.ts` (three sites), `packages/core/src/index.ts` (one site)
- Create: `docs/src/content/docs/rules/architecture/route-component-import.md` and its `ja/` counterpart
- Modify: `docs/src/content/docs/rules/**/index.mdx` (regenerated, never hand-edited)
- Create: `.changeset/route-component-import.md`

**Interfaces:**

- Consumes: `architectureRouteComponentImport` from
  `packages/core/src/rules/architecture/route-component-import.js` (Task 2).
- Produces: nothing further.

- [ ] **Step 1: Register in all four places**

In `packages/core/src/rules/index.ts`, beside the existing `architectureReservedDirectoryNames` entries
(lines 67, 139, 212 — the import, the `allRules` array, and the re-export block):

```ts
import { architectureRouteComponentImport } from './architecture/route-component-import.js';
```

and add `architectureRouteComponentImport` to the `allRules` array and to the re-export block, keeping
each list's existing ordering convention.

In `packages/core/src/index.ts`, add `architectureRouteComponentImport` to the
`export { … } from './rules/index.js'` list (near line 133). **TypeScript will not catch a miss here** —
it is a plain re-export list. After editing, verify with:

```bash
grep -rn "architectureRouteComponentImport" packages/core/src/ | grep -v "rules/architecture/route-component-import.ts"
```

Expected: four lines (three in `rules/index.ts`, one in `index.ts`).

- [ ] **Step 2: Write the English rule page**

Create `docs/src/content/docs/rules/architecture/route-component-import.md`, matching the structure of
`docs/src/content/docs/rules/architecture/private-scope-import.md`:

````md
---
title: architecture/route-component-import · Route component import
description: A SvelteKit route entry is rendered by the framework, not imported by other components.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags an import of a SvelteKit route entry — `+page.svelte`, `+layout.svelte`, `+error.svelte`, and their
`@` breakout forms — from another component.

## Why it matters

A route entry is written on the assumption that SvelteKit renders it. Kit hands a page its `data` and
`params`, and an error page its `page.error` and `page.status`. Imported from somewhere else, the
component receives none of that and renders against nothing — or against the importing page's data
standing in for its own.

The mistake is easy to make and reads as reasonable: another page needs the same markup, the markup
already exists in a `+page.svelte`, so it gets imported. Nothing else objects, and the component renders
— emptily.

## How to fix

Extract the shared markup into a component under `$lib` and import that from both places, leaving the
route entry to SvelteKit.

## Configuration

| Option            | Type          | Default                                                           |
| ----------------- | ------------- | ----------------------------------------------------------------- |
| `exemptImporters` | `string-list` | `['**/*.stories.svelte', '**/*.test.svelte', '**/*.spec.svelte']` |

Files matching `exemptImporters` may import a route entry: a story renders it to look at, a test renders
it to assert on, and both supply by hand what SvelteKit would have supplied.

**The default is deliberately narrow, and configuring it is an expected step rather than an exceptional
one.** A `string-list` option adds to its default and never replaces it, so you can extend this list but
not shrink it — which is why it ships covering only the conventions that are common across the ecosystem.
If your project marks satellite files another way, add your pattern:

```js
// svelte-vitals.config.js
export default {
  rules: {
    'architecture/route-component-import': {
      options: { exemptImporters: ['**/*.fixture.svelte'] }
    }
  }
};
```
````

## Not reported

- A dynamic `import()` of a route entry — it is not an import declaration, so the analyzer does not see it.
- An import made from a plain `.ts` or `.js` file, or from a `.svelte.ts` / `.svelte.js` module: import
  facts are collected from `.svelte` component files only.
- A type-only import (`import type P from './+page.svelte'`, or one whose every specifier is inline-typed)
  — it is erased at build, so nothing renders.
- A project whose routes live somewhere other than `src/routes`.

````

- [ ] **Step 3: Write the Japanese rule page**

Create `docs/src/content/docs/ja/rules/architecture/route-component-import.md` with the same structure and
the same claims, in idiomatic Japanese. Match the tone and section headings of the neighbouring
`docs/src/content/docs/ja/rules/architecture/private-scope-import.md`. Keep code blocks, option names, and
rule ids in their original form.

- [ ] **Step 4: Regenerate the rule index pages**

```bash
pnpm --filter svelte-vitals run gen:rules-index
node_modules/.bin/oxfmt --write docs
````

Never hand-edit the generated `index.mdx` files.

- [ ] **Step 5: Add the changeset**

Create `.changeset/route-component-import.md`, matching the format of the existing entries in that
directory:

```md
---
'@svelte-vitals/core': patch
---

Add `architecture/route-component-import`, which reports a component importing a SvelteKit route entry
(`+page.svelte`, `+layout.svelte`, `+error.svelte`, and their `@` breakout forms).

This is the first Architecture rule that is **on by default**, so a project that changes nothing may see
new findings at `info`. Kit renders a route entry with the data it supplies; imported elsewhere the
component renders without it. Stories, tests and specs are exempt by default, and `exemptImporters`
extends that list for a project whose satellite files are named another way.
```

- [ ] **Step 6: Run every gate**

```bash
node_modules/.bin/tsc --noEmit -p packages/core/tsconfig.json
(cd packages/core && ../../node_modules/.bin/tsup)
(cd packages/core && ../../node_modules/.bin/vitest run)
(cd packages/cli && ../../node_modules/.bin/vitest run)
(cd packages/vite && ../../node_modules/.bin/vitest run)
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
```

Expected: PASS throughout, **including** `packages/cli/test/docs-links.test.ts` (both language pages
exist) and `packages/cli/test/rules-index.test.mjs` (the generated index is current). If either fails,
fix the docs or regenerate the index — do not edit those tests.

The docs site build cannot run in this sandbox; CI's `docs` job is that gate. Verify the two new pages'
frontmatter and MDX syntax by eye instead, and say in your report that the build was not run.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src docs .changeset
git commit -m "feat(core): register and document architecture/route-component-import"
```

---

## Self-Review

**Spec coverage.** The spec's four-step check maps to Task 2's `routeEntryImports` (steps 1-3) and `bad`
(step 4); `+error.svelte`'s inclusion and the `@` forms are in `isRouteEntry` and its tests; the
`exemptImporters` `string-list` with its narrow-default rationale is in Task 2 and restated on the docs
page; the `applies`/`bad` assignment and the exempt-file PASS are Task 2 Step 7's third mutation; the
`importSpans` `type?: true` extension is Task 1. Every deliverable the spec lists appears: the rule
module, the fact extension, registration in four places plus regenerated index pages, both docs pages, and
the changeset. The spec's Testing groups 1-4 are Task 2 Steps 3 and 7 and Task 1 Step 5.

**Two things the spec does not say, decided here and recorded rather than left implicit:**

1. **The harness needed a parameter.** The spec names `componentRule` as the harness, but that harness
   does not hand its callbacks the `RuleContext`, and without it the rule cannot read
   `ctx.project.kitAliases` — so it would silently fail to resolve any aliased specifier, which is most of
   them in the tree this rule was measured against. `kitModuleRule` already passes `ctx`, so Task 2 Step 1
   brings the two into line rather than inventing anything.
2. **`type` covers the inline form too.** The spec says the flag is set "when the declaration's
   `importKind` is `type`". That leaves `import { type A } from './+page.svelte'` reported, and since
   nothing renders in that case it would be a false positive in a **default-on** rule. Task 1 therefore
   marks a declaration whose every specifier is inline-typed as well, and the field's comment states
   exactly what it means. A specifier-less side-effect import stays unmarked, and has its own test.

**Also recorded for the spec's "Deliberately not solved" list:** a `.svelte.ts` / `.svelte.js` runes module
is in the component fact set but `parseModuleFacts` leaves its `importSpans` empty, so a route-entry import
made from one is invisible to this rule. That is a narrower gap than the spec's "plain `.ts` files are not
in the fact set", and the docs page states both.

**Type consistency.** `importSpans`' element type is `{ source: string; line: number; type?: true }` in the
fact, the parser accumulator, and the rule's destructuring. `resolveRepoLocalPath`'s third parameter is
`readonly KitAlias[] | undefined` and `ctx.project.kitAliases` is `KitAlias[] | undefined` — assignable.
`applies`/`bad` take `(c, o, ctx)` in the harness type, the harness call sites, and the rule.
