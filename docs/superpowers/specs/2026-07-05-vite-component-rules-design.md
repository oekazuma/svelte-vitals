# Vite plugin: component-scoped rule coverage (build mode)

**Date:** 2026-07-05
**Status:** Approved design
**Packages:** `@svelte-vitals/core` (extraction), `@svelte-vitals/vite` (new collector + wiring), `svelte-vitals` (internal import-path update only)

## Goal

`@svelte-vitals/vite`'s build-mode plugin currently only sees rendered HTML
output, so it never populates `RuleContext.components`, and every
component-scoped rule (`componentRule()`-based) silently emits nothing there.
Concretely, 10 rules are missing from vite today: **CORRECT001–004**,
**SEC001–002**, **ARCH001–002**, and — less obviously, since "Performance" as a
category otherwise works in vite via rendered-mode rules — **PERF009–010**
(heavy/namespace import detection, which is component-scoped like the others).

The CLI (`svelte-vitals`) and MCP (which calls into the CLI's `analyzeProject`)
already get all of these via `collectComponentFacts`, a glob-and-parse step over
`src/**/*.svelte` that has nothing to do with rendered HTML. This design adds
the equivalent capability to vite's **build mode only** (not the dev overlay,
which is architecturally a per-request rendered-HTML view and has no natural
hook for a whole-project source scan — `dev-overlay.md` already scopes it to
SEO `<head>` rules only, and that boundary is unchanged by this work).

The 10 newly-available rules are **enabled by default** for existing vite
plugin users, consistent with how the CLI has always shipped new rules as
default-on within minor releases. Users who need to opt out use the existing
per-rule `options.rules` config (e.g. `{ CORRECT002: 'off' }`), same as today.

## Background / current state

- `packages/core/src/rules/component-rule.ts`'s `componentRule()` factory reads
  `ctx.components: ComponentFacts[]` and no-ops (nothing emitted, not even a
  pass) when that field is absent/empty. This is intentional and documented in
  the file's own comment ("CLI/static only").
- `ComponentFacts`/`SuppressionDirective` types already live in
  `@svelte-vitals/core` (`packages/core/src/component.ts`) — only the _parsing
  logic_ that produces them is CLI-only.
- That parsing logic lives in `packages/cli/src/providers/source/parse.ts`
  (~700 lines) and splits into three layers, verified by reading the file and
  cross-checking every helper's call sites:
  1. **SEO/head-tag parsing** — `parseFile`, `parseHeadTags`,
     `collectSvelteHeads`, `tagsFromHead`, `collectComponents`,
     `collectImages`, `collectHeadings`. Untouched by this work; vite already
     has an equivalent rendered-HTML-based path for this
     (`providers/rendered/*`).
  2. **Generic Svelte-AST utilities**, used by _both_ layer 1 and layer 3:
     `CHILD_NODE_KEYS`, `lineOf`, `findAttr`, `valueFromNodes`,
     `textFromNodes`, `attrText`, `attrValue`, `attrValueOf`, `attrTextOf`,
     the `type Node = any` alias.
  3. **Component-facts parsing** (the part vite needs): `parseComponentFacts`
     and its private helpers — `walkEstree`, `isEffectCall`,
     `isStateDeclaration`, `bodyOnlyAssignsState`, `isDerivedDeclaration`,
     `addBoundNames`, `rootObjectName`, `collectStateWrites`,
     `COMPONENT_LIKE_TYPES`, `collectTemplateEscapes`, `RUNE_NAMES`,
     `bodyReadsReactive`, `bodyIsEmpty`, `URL_ATTRS`, `collectSecurityFacts`,
     `isPropsCall`, `countProps`, `countLines`, `collectImportSources`,
     `isBareSpecifier`, `collectNamespaceImports`, `JS_DIRECTIVE`,
     `HTML_DIRECTIVE`, `collectSuppressions`, `isConstantListEach`,
     `collectEachBlocks`.
  4. `attrValueOf`/`attrTextOf` are additionally imported by
     `packages/cli/src/providers/source/adapters/svelte-meta-tags.ts` and
     `svelte-seo.ts` (both SEO-domain adapters) via a relative import from
     `parse.js` — confirmed these are CLI-internal cross-module helpers, never
     re-exported from `svelte-vitals`'s public `index.ts`, so moving them has
     no public-API consequence.
- `packages/cli/src/providers/source/components.ts`'s `collectComponentFacts(rt,
cwd)` (the glob-and-read wrapper around `parseComponentFacts`) already takes
  an injected `Runtime` (`packages/core/src/runtime.ts`) rather than hardcoding
  `node:fs` — but `Runtime` itself, and this wrapper, stay CLI-only; vite gets
  its own trivial direct implementation (no abstraction needed — vite always
  runs in Node, unlike the CLI which is tested against a memory runtime).
- `@svelte-vitals/core`'s `package.json` currently declares no `dependencies`
  at all (its own description: "Shared, runtime-agnostic core… "). Moving
  `parseComponentFacts` in adds exactly one new dependency, `svelte` (for
  `svelte/compiler`'s `parse`), matching how `svelte-vitals` already depends on
  `svelte` via the pnpm `catalog:` version. `svelte/compiler`'s `parse()` is a
  pure string→AST function with no Node-specific I/O, so this doesn't
  compromise core's runtime-agnostic status.
- `packages/vite/src/analyze.ts`'s `analyze(prerenderPagesDir, cwd, options)`
  already receives the project root as `cwd` and builds a `RuleContext` of
  `{ heads, headings, images, project, config }` — no `components` key.
  `packages/vite/package.json` already depends on `tinyglobby` (used today in
  `providers/rendered/collect.ts` via `import { glob } from 'tinyglobby'`), so
  no new vite dependency is needed for the new collector.
- `packages/vite/test/analyze.test.ts` already spins up a real temp directory
  (`mkdtemp` + `writeFile`) and calls `analyze()` directly — the natural place
  to extend for an integration-level test of the new component-facts wiring.

## Design

### 1. Extract shared parsing into `@svelte-vitals/core`

Two new files:

- **`packages/core/src/svelte-ast.ts`** — the generic Svelte-AST utility bucket
  (layer 2 above): `type Node = any` (with the same
  `/* eslint-disable @typescript-eslint/no-explicit-any */` comment the
  original carries), `CHILD_NODE_KEYS`, `lineOf`, `findAttr`, `valueFromNodes`,
  `textFromNodes`, `attrText`, and the three currently-exported functions
  `attrValue`, `attrValueOf`, `attrTextOf` (same signatures, moved verbatim).
- **`packages/core/src/component-parse.ts`** — `parseComponentFacts` and all of
  layer 3's private helpers, moved verbatim, importing the shared utilities
  from `./svelte-ast.js`. `parseComponentFacts`'s signature and return shape
  are unchanged: `(source: string, filename: string) => { eachBlocks,
effects, htmlTags, javascriptUrls, loc, propCount, imports,
namespaceImports, constableStates, suppressions }`.

Both files are pure (no I/O), matching every other file already in
`packages/core/src/`.

`packages/core/src/index.ts` re-exports: `parseComponentFacts` (new),
`attrValue`, `attrValueOf`, `attrTextOf` (moved) — these three don't currently
appear in `packages/core/src/index.ts`'s public surface (they were CLI-only),
so this is a net-new public export, not a relocation of an existing one.

`packages/core/package.json` gains `"dependencies": { "svelte": "catalog:" }`.

### 2. Shrink `packages/cli/src/providers/source/parse.ts`

Delete everything in layers 2 and 3 (moved above). Add
`import { parseComponentFacts } from '@svelte-vitals/core';` and
`import { attrValue, attrValueOf, attrTextOf, findAttr, lineOf,
CHILD_NODE_KEYS } from '@svelte-vitals/core';` (only importing what this file's
remaining layer-1 code actually still calls — `attrText`/`valueFromNodes`/
`textFromNodes` become core-internal-only if layer 1 doesn't call them
directly; verify at implementation time and only import what's used).
`packages/cli/src/providers/source/components.ts`'s
`collectComponentFacts(rt, cwd)` changes its `parseComponentFacts` import from
the local relative path to `@svelte-vitals/core` — no other change; the
function's behavior, signature, and the `Runtime`-based glob/read logic are
untouched.

`packages/cli/src/providers/source/adapters/svelte-meta-tags.ts` and
`svelte-seo.ts` change their `attrValueOf`/`attrTextOf` import from `'../parse.js'`
to `'@svelte-vitals/core'`.

No behavior changes anywhere in the CLI package — this is a pure
import-path/location refactor, verified by the full existing CLI + core test
suites passing unmodified in assertions (only import paths move in the test
files, per the Testing section).

### 3. New vite-side collector

**`packages/vite/src/providers/source/components.ts`** (new):

```ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { glob } from 'tinyglobby';
import { parseComponentFacts, type ComponentFacts } from '@svelte-vitals/core';

/** Scan every `.svelte` component under `src/` and parse Correctness/Security/
 *  Architecture/Bundle-Performance facts (build mode only — see design doc). */
export async function collectComponentFacts(root: string): Promise<ComponentFacts[]> {
  const files = await glob('src/**/*.svelte', { cwd: root, dot: false });
  return Promise.all(
    files.sort().map(async (rel): Promise<ComponentFacts> => {
      try {
        const source = await readFile(join(root, rel), 'utf8');
        return { file: rel, ...parseComponentFacts(source, rel) };
      } catch {
        return {
          file: rel,
          eachBlocks: [],
          effects: [],
          htmlTags: [],
          javascriptUrls: [],
          loc: 0,
          propCount: 0,
          imports: [],
          namespaceImports: [],
          constableStates: [],
          suppressions: []
        };
      }
    })
  );
}
```

This deliberately does not go through `Runtime` — vite always runs in Node, so
there's no swappable-runtime need the way the CLI has (the CLI tests against
an in-memory runtime; vite's own tests already use real temp directories, per
`analyze.test.ts`).

### 4. Wire into `analyze()`

`packages/vite/src/analyze.ts`: add
`import { collectComponentFacts } from './providers/source/components.js';`,
call `const components = await collectComponentFacts(cwd);` alongside the
existing `collectRenderedProject` call, and add `components` to the
`runRules` context: `{ heads, headings, images, project, components, config
}`. This call is unconditional — independent of whether any prerendered pages
exist, since it doesn't touch `prerenderPagesDir` — so it runs even in the
"0 routes" case (that early-exit already happens in `plugin.ts`, after
`analyze()` returns, for reporting/gating purposes only, not before).

Extend the `coverageNote` with a second line:

```
`Analyzed ${heads.length} prerendered route(s). ` +
'SSR/dynamic routes are not covered — run `npx svelte-vitals` for those.\n' +
`Scanned ${components.length} component(s) under src/ for Correctness/Security/Architecture/Bundle findings.`
```

No change to `packages/vite/src/plugin.ts` — `closeBundle`'s existing call to
`analyze()` picks this up automatically.

### 5. Docs

- `docs/src/content/docs/guides/plugin-mode.md` (+ `ja`): after the existing
  "library-agnostic" framing (build mode inspects rendered HTML), add a
  paragraph: build mode _additionally_ scans `.svelte` source directly for
  Correctness/Security/Architecture and the two component-scoped Performance
  rules (PERF009–010), listing the same rule-id set as the CLI guide's
  suppression-directive section for consistency.
- `docs/src/content/docs/guides/dev-overlay.md` (+ `ja`): add one sentence
  next to the existing "SEO `<head>` rules only" scoping statement, clarifying
  that component-scoped rules are build-mode-only and don't appear in the dev
  overlay, so users aren't confused by a discrepancy between `vite dev` and
  `vite build` results.
- Check `docs/src/content/docs/guides/choosing-a-package.md` for any
  per-package category-coverage table/claim and update it if it currently
  states vite is SEO/Performance-only.

### 6. Changeset

- `@svelte-vitals/core` — **minor** (new public exports: `parseComponentFacts`,
  `attrValue`, `attrValueOf`, `attrTextOf`; new `svelte` dependency).
- `@svelte-vitals/vite` — **minor** (new default-on rule coverage in build
  mode).
- `svelte-vitals` — a changeset noting "internal refactor: component-facts
  parsing moved to `@svelte-vitals/core`; no user-facing behavior change,"
  bumped **patch**. If implementation turns up any user-visible edge case,
  that gets raised before merging rather than silently absorbed here.

## Testing

- **Move, don't rewrite:** the existing `parseComponentFacts`-focused
  `describe` blocks in `packages/cli/test/parse-component-facts.test.ts`
  (everything except the final `collectComponentFacts (memory runtime)`
  block) move verbatim to a new `packages/core/test/component-parse.test.ts`,
  importing from `'../src/component-parse.js'` instead of
  `'../src/providers/source/parse.js'`. No assertions change.
- The remaining `collectComponentFacts (memory runtime)` block stays in
  `packages/cli/test/parse-component-facts.test.ts` (or is renamed/moved into
  `packages/cli/test/collect-component-facts.test.ts` if the file reads
  oddly with only one block left — implementer's judgment), updated only to
  import `parseComponentFacts` from `@svelte-vitals/core` if it references it
  directly.
- `packages/cli/test/suppression-e2e.test.ts` updates its `parseComponentFacts`
  import to `@svelte-vitals/core`; assertions unchanged.
- New: `packages/core/test/svelte-ast.test.ts` is **not** required as a
  separate file if the moved `component-parse.test.ts` and the CLI's existing
  SEO-parsing tests already exercise every moved utility indirectly; add
  direct unit tests only for any utility that would otherwise have no
  coverage after the move (check coverage before deciding).
- New: extend `packages/vite/test/analyze.test.ts` — add a `.svelte` file
  under `<cwd>/src/` in the existing temp-dir fixture (e.g. one with an
  unkeyed `{#each}` or an assign-only `$effect`) and assert the `analyze()`
  result includes the corresponding CORRECT/SEC/ARCH/PERF00x finding.
- New: `packages/vite/test/collect-component-facts.test.ts` — unit tests for
  the new thin collector against a real temp directory (mirroring
  `analyze.test.ts`'s `mkdtemp` pattern): finds `.svelte` files under `src/`,
  ignores non-`.svelte` files, returns facts matching what
  `parseComponentFacts` would produce for the same source.
- Full monorepo suite + typecheck + lint + `docs build` green; no loosened
  assertions anywhere in the moved tests.

## Out of scope (YAGNI)

- Dev-overlay support for component-scoped rules — architecturally
  incompatible with the overlay's per-request rendered-HTML model (see Goal).
- An opt-out flag for the new default-on rules — users use the existing
  per-rule `options.rules` config instead.
- Deduplicating the _second_ `svelte/compiler` `parse()` call that already
  happens today when a CLI run wants both head-tags and component-facts for
  the same file (pre-existing minor inefficiency, unrelated to this feature).
- Any change to `@svelte-vitals/mcp` — it already gets full component-rule
  coverage by calling the CLI's `analyzeProject` directly; untouched by this
  work.
