# Architecture category — component-size metrics (ARCH001/ARCH002)

**Date:** 2026-06-30
**Status:** Approved (per maintainer; next slice of #69)
**Packages:** `@svelte-vitals/core` (category + rules), `@svelte-vitals/mcp` (surfaces via `allRules`)

## Goal

Third "Svelte Doctor" code-health category, reusing the component-body scan
(`ctx.components`, CLI/static only). High-precision, pure-counting metrics that flag
AI-bloated "god components" — no overlap with the compiler / svelte-check / eslint.

Taken before the "More Correctness/reactivity" slice: those reactivity heuristics
are lower-precision / partly compiler-covered, which conflicts with the no-false-
positive principle. Architecture metrics are deterministic counts.

| ID      | Check                       | Severity | Default threshold |
| ------- | --------------------------- | -------- | ----------------- |
| ARCH001 | Component too large (lines) | info     | > 400 lines       |
| ARCH002 | Too many props              | info     | > 10 props        |

`info`, because size/props are advisory smells, not defects.

## Design

### Facts (`ComponentFacts`)

- `loc: number` — source line count of the `.svelte` file.
- `propCount: number` — number of named props destructured from `$props()`
  (`let { a, b } = $props()` → 2). A rest element (`...rest`) or a non-destructured
  `let p = $props()` makes the count unknowable → `propCount: 0` (never flagged).

### Rules (via the shared `componentRule` factory)

`ComponentCategory` widens to include `'architecture'`. Both rules use
`severity: 'info'` and thresholds as named constants:

- **ARCH001** — `applies: (c) => c.loc > 0` (skip unanalyzable files — `loc: 0`
  is the read/parse-failure fallback, not a real 0-line component); `bad`: one
  finding when `loc > MAX_LOC` (400).
- **ARCH002** — `applies: (c) => c.propCount > 0`; `bad`: one finding when
  `propCount > MAX_PROPS` (10).

Findings are file-unit scored (route + location = file), like the other component
categories. Console reporter `CATEGORY_ORDER`/`CATEGORY_LABEL` gains 'architecture'
(html/json enumerate dynamically); docs-link test allowlist gains it.

## Out of scope (later)

- Template nesting depth (needs a depth walk — defer to keep this slice tight).
- Configurable thresholds (config surface) — ship sensible defaults first.

## Testing

- Parser facts: `loc` counts lines; `propCount` from a destructured `$props()`;
  rest element / non-destructured `$props()` → 0.
- Rules: ARCH001 flags an over-`MAX_LOC` file / passes a small one; ARCH002 flags
  a > `MAX_PROPS` component / passes few props / no props; both no-op when
  `ctx.components` unset.
- Console reporter shows an Architecture score line. Docs (en+ja), changeset.
- Full `pnpm -r test` + typecheck + lint + docs build green.
