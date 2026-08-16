---
'@svelte-vitals/core': minor
'@svelte-vitals/vite': patch
'svelte-vitals': patch
---

Split `@svelte-vitals/core` into two entry points ahead of 1.0.

`@svelte-vitals/core` now exports only what an outside caller needs: `defineConfig` with the
config types, and the `JsonReport` types for reading a report. Everything else — the engine,
the rule set, fact collection, reporters, scoring — moved to `@svelte-vitals/core/internal`,
which carries **no semver guarantee and may change in any release, including a patch**.

The stable entry is deliberately type-closed: no export there may reference a type that only
`/internal` exports, so internal reshaping can never break the promised surface. Nothing was
deleted, and `svelte-vitals` / `@svelte-vitals/vite` behaviour is unchanged. Code importing
engine internals from the package root should move those imports to `/internal`; if something
there is what you actually need long-term, open an issue — promoting a name into the stable
entry is an additive change.
