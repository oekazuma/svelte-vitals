# PERF010 — Namespace (whole-library) import

**Date:** 2026-07-01
**Status:** Approved design
**Packages:** `@svelte-vitals/core` (rule), `@svelte-vitals/cli` (capture), `@svelte-vitals/mcp` (surfaces the rule)

## Goal

Complete the **Bundle/perf** slice of #69 (heavy deps shipped as PERF009). Add
**PERF010 — namespace import**, which flags a value `import * as X from '<bare
package>'`. A namespace import forces the bundler to keep the whole module, so
named imports (`import { x } from 'pkg'`) should be preferred for tree-shaking.
Advisory, so `info` severity.

This covers the "whole-library import" of _arbitrary_ packages that PERF009 does
not: PERF009 matches only a curated heavy list by exact specifier; for any other
package a named import is tree-shakeable and carries no signal, but a namespace
import of any package is the whole-library form.

## Scope

**Flagged:** a value namespace import whose specifier is a **bare** package.

```js
import * as _ from 'lodash'; // ✗ flag
import * as THREE from 'three'; // ✗ flag (named imports tree-shake better)
```

**Not flagged:**

- Type-only imports — erased at build, no bundle cost:
  `import type * as T from 'pkg'`, and a namespace specifier whose own
  `importKind` is `'type'`.
- Non-bare specifiers — relative or alias-local code:
  `import * as u from './utils'`, `'$lib/…'`, `'$app/…'`, `'$env/…'`,
  `'#internal'`.
- Named / default imports — `import { x } from 'pkg'`, `import x from 'pkg'`
  (tree-shakeable; no signal).

**Bare specifier** = does not start with `.`, `/`, `$`, or `#`.

No allowlist: the pattern is a genuine bundle signal for every package (even
`three`/`d3` tree-shake better with named imports), and `info` severity keeps it
advisory. Keeping the rule allowlist-free avoids a second curated data surface.

## Design

### 1. Capture model — `ComponentFacts.namespaceImports`

`ComponentFacts.imports: string[]` stays unchanged (PERF009 depends on it). Add a
focused field:

```ts
/** Value `import * as X from '<bare pkg>'` namespace imports (type-only excluded) — Bundle PERF010. */
namespaceImports: {
  source: string;
  line: number;
}
[];
```

Populated in `packages/cli/src/providers/source/parse.ts` alongside
`collectImportSources`, over both the module (`<script module>`) and instance
(`<script>`) programs. An `ImportDeclaration` contributes an entry when:

1. the declaration is not type-only (`node.importKind !== 'type'`), and
2. it has a specifier of type `ImportNamespaceSpecifier` whose own
   `importKind !== 'type'`, and
3. `node.source.value` is a bare specifier (see above).

`line = lineOf(source, node.start)` (1-based; the existing helper). The `source`
is `node.source.value`.

Implementation note: extend the existing walk rather than adding a second pass.
`collectImportSources` currently pushes `node.source.value`; a sibling collector
(or an added branch in the same `walkEstree`) pushes namespace entries. Keep the
two outputs separate so PERF009 is untouched.

### 2. Rule — `perf010-namespace-import.ts`

Built with the existing `componentRule` factory (CLI/static only; `ctx.components`
is unset in rendered mode, so it no-ops there — same as PERF009).

- `id: 'PERF010'`, `title: 'Namespace import'`, `category: 'performance'`,
  `severity: 'info'`, `scope: 'component'`.
- `label` (PASS): `'No namespace imports'`.
- `recommendation`: `"Use named imports (import { x } from 'pkg') instead of import * as — a namespace import keeps the whole module in the bundle."`
- `rationale`: `'A namespace import (import * as X) forces the bundler to retain the entire module, so unused exports cannot be tree-shaken out.'`
- `applies`: `(c) => c.namespaceImports.length > 0`.
- `bad`: dedupe by `source`; one finding per distinct bare package, using the
  first occurrence's line:

  ```ts
  bad: (c) => {
    const seen = new Set<string>();
    const out: { line: number; message: string }[] = [];
    for (const ns of c.namespaceImports) {
      if (seen.has(ns.source)) continue;
      seen.add(ns.source);
      out.push({
        line: ns.line,
        message: `Namespace import "* as … from '${ns.source}'" — prefer named imports so the bundler can tree-shake`
      });
    }
    return out;
  };
  ```

`componentRule` emits a PASS (detection `own`/`static`) when `applies` is true
and `bad` is empty, and one PENALIZED finding per `bad` entry (with `line` when

> 0. — identical shape to PERF009.

### 3. Registration & surfaces

- Export `perf010NamespaceImport` from `rules/performance/perf010-namespace-import.ts`.
- Import + append to `allRules`, and add to the re-export blocks in
  `packages/core/src/rules/index.ts` and `packages/core/src/index.ts`
  (after `perf009HeavyImport`), following the PERF009 registration pattern.
- MCP `analyze` / `explain_rule` surface it automatically via `allRules` — no MCP
  code change beyond the version bump.

### 4. Docs

Two reference pages following the PERF009 format (title; `**Severity:** info ·
**Category:** performance`; What it checks / Why it matters / How to fix):

- `docs/src/content/docs/rules/perf010.md`
- `docs/src/content/docs/ja/rules/perf010.md`

### 5. Changeset

Mirror the PERF009 changeset package set — `@svelte-vitals/core`,
`svelte-vitals`, `@svelte-vitals/mcp` — all **minor**. (Not `@svelte-vitals/vite`:
the rule is CLI/static-only and no-ops in rendered mode, matching PERF009.)

## Testing

- **Capture** (`packages/cli` parse tests): a value `import * as X from 'pkg'`
  yields one `namespaceImports` entry with the bare `source` and a 1-based
  `line`; `import type * as T from 'pkg'` and a type-only namespace specifier are
  excluded; relative / `$lib` / `$app` namespace imports are excluded; named and
  default imports produce no `namespaceImports` entry; imports in both `<script>`
  and `<script module>` are seen.
- **Rule** (`packages/core`): a component with a bare namespace import fails
  (one finding; two namespace imports of the same package dedupe to one; two
  different packages give two findings); a component with only named/default
  imports passes; a component with no namespace imports is no-signal
  (`applies` false → no result).
- Full suite + typecheck + lint + `docs build` green; no assertions loosened.

## Out of scope (YAGNI)

- Barrel-file imports (`$lib` / project `index` re-exports) — Vite tree-shakes
  ESM barrels, so low precision; conflicts with #69's high-precision principle.
- A general default/named/namespace import-kind model — only namespace is needed
  now.
- Allowlist / configurable thresholds.
