# Bundle depth — heavy dependency imports (PERF009)

**Date:** 2026-07-01
**Status:** Approved (per maintainer; #69 Bundle/perf slice)
**Packages:** `@svelte-vitals/core` (rule), `@svelte-vitals/cli` (import capture), `@svelte-vitals/mcp` (surfaces via `allRules`)

## Goal

Flag imports of well-known **heavy / non-tree-shakeable packages** that bloat the
bundle — a common "AI wrote `import _ from 'lodash'`" mistake. Allowlist-precise
(exact package match), so no false positives. Reuses the component-body scan
(`ctx.components`, CLI/static). Reported under the existing **performance** category.

| ID      | Check                   | Severity |
| ------- | ----------------------- | -------- |
| PERF009 | Heavy dependency import | info     |

## Design

### Facts (`ComponentFacts`)

- `imports: string[]` — module specifiers of every `import` in the component's
  instance and module `<script>` (ESTree `ImportDeclaration.source.value`).

### Rule (via the shared `componentRule` factory)

`ComponentCategory` widens to include `'performance'` (component-scoped perf).
PERF009 checks each import specifier against an allowlist:

```
HEAVY_PACKAGES = {
  lodash: 'Import a submodule (lodash/debounce) or use lodash-es for tree-shaking.',
  moment: 'Use a lighter date library (date-fns, dayjs) — moment is large and not tree-shakeable.',
}
```

Matched **exactly** (`lodash`, not `lodash/debounce` — the subpath form is the fix).
`severity: 'info'`. File-unit scored like the other component rules.

## Testing

- Parser facts: `imports` collects instance + module script specifiers; subpath
  and unrelated imports are recorded verbatim.
- Rule: flags `lodash` / `moment`; passes `lodash/debounce`, `date-fns`, and a
  component with no heavy import; no-op when `ctx.components` is unset.
- Docs (en+ja), changeset. Full `pnpm -r test` + typecheck + lint + docs green.

## Out of scope

- Measuring actual byte size / bundle analysis (needs a bundler) — allowlist only.
- Configurable allowlist (config surface) — ship sensible defaults first.
- `import * as X` namespace-import heuristics (bundler-dependent; deferred).
