# SEO031 — SSR disabled

**Date:** 2026-07-21
**Status:** Approved design
**Packages:** `@svelte-vitals/core` (fact + rule), `svelte-vitals` / `@svelte-vitals/vite` / `@svelte-vitals/mcp` (surface automatically)

## Goal

Add **SEO031**: flag SvelteKit route files that disable server-side rendering
(`export const ssr = false`). The official SEO best-practices doc's headline
risk — "server-side rendered content is indexed more frequently and
reliably… you should leave it on unless you have a good reason not to" — and
the performance doc's SPA-mode warning ("an empty page is generated, which
fetches JavaScript… extra network round trips before a single pixel can be
displayed") both point at the same flag.

`warning` severity, `category: 'seo'`, `scope: 'component'` (file = scoring
unit). A deliberate SPA is a legitimate architecture — the escape hatches are
the standard ones (rule config `SEO031: 'off'`, inline suppression).

Sourced from the best-practices survey (2026-07-21) of
`sveltejs/kit/documentation/docs/40-best-practices` — candidate B of three
(PERF012 `minify: false` and PERF011 load waterfalls follow on separate
branches).

## Background

- Detection already exists: `hasSsrFalseOptOut(program)` in
  `packages/core/src/kit-module-parse.ts` (built for CORRECT008's opt-out)
  handles the inline form (`export const ssr = false`, `satisfies`/`as`
  unwrapped) and the same-file alias-export form
  (`const ssr = false; export { ssr };`). This design promotes it from an
  internal boolean guard to a recorded fact.
- The Kit channel (`KitModuleFacts`, collectors, `kitModuleRule` factory,
  suppressions) is in place from SEC003–005 / CORRECT007–008.
- `kitModuleRule`'s `category` is currently typed as the literal `'security'`
  — widened to `'security' | 'seo'` (one-line type change; runtime already
  passes the option through).

## Design

### 1. Fact — `KitModuleFacts.ssrDisabled`

```ts
/** Set when this file disables SSR via `export const ssr = false` (inline or same-file alias export) — the declaration's line (SEO031). */
ssrDisabled?: { line: number };
```

Optional (absent = SSR on) — no literal churn in existing fixtures/tests.
Implementation: `hasSsrFalseOptOut` becomes `findSsrFalseOptOut(program):
{ line: number } | undefined` returning the `ssr` declarator's line
(wrap-shifted −1 like every other kit fact); the CORRECT008 browser-global
opt-out keeps using its truthiness — behavior unchanged, existing tests are
the regression bar. Both detection forms (inline export incl.
`satisfies`/`as`; alias export) report the **declaration** line.

### 2. Rule — SEO031

`packages/core/src/rules/seo/seo031-ssr-disabled.ts`, built with
`kitModuleRule` (category type widened):

- `id: 'SEO031'`, `title: 'SSR disabled'`, `category: 'seo'`,
  `severity: 'warning'`, `scope: 'component'`.
- `label` (PASS): `'SSR enabled'`.
- `applies`: `(m) => m.ssrDisabled !== undefined`.
- Message variants (root layout = the flag applies app-wide):
  - file is `src/routes/+layout.ts|js` or `src/routes/+layout.server.ts|js`:
    `` `SSR is disabled for the whole app — search engines index server-rendered content more reliably, and SPA mode adds a network round trip before first paint` ``
  - any other route file:
    `` `SSR is disabled for this route — its content is invisible to crawlers that don't execute JavaScript and indexes less reliably` ``
- `recommendation`: `"Keep SSR on for indexable pages; restrict ssr = false to routes that don't need SEO (authenticated dashboards, app-only views). For a deliberate SPA, turn this rule off in the config or add an inline suppression."`
- `rationale`: `"SvelteKit's SEO guidance is to leave SSR on unless there is a good reason not to: server-rendered content is indexed more frequently and reliably, and SPA mode costs an extra network round trip before anything renders."`

Not flagged: `csr = false` (server-only rendering — good for SEO),
`ssr = true`, non-literal values (`ssr = dev` — unknowable statically,
conservative miss). `prerender = true` alongside `ssr = false` is still
flagged (the prerendered output is an empty shell).

### 3. Registration, docs, changeset

- Usual four sites + grep check (SEO031 lands next to the other SEO rules'
  entries).
- Docs: `docs/src/content/docs/rules/seo031.md` + ja mirror (en/ja together).
  No suppression-range edits exist anymore (removed in PR #240).
- Changeset: core / `svelte-vitals` / vite / mcp — **minor**.

## Testing

- **Fact** (kit-module-parse tests): inline `export const ssr = false` →
  `{ line }`; `satisfies` form; alias-export form; NOT set for `csr = false`,
  `ssr = true`, non-exported `const ssr = false`, `ssr = dev`; line numbers
  wrap-shifted.
- **Rule**: root-layout variant message; leaf-route variant message; warning
  severity; suppression on the declaration line; rendered-mode no-op; PASS
  unit absent when `ssrDisabled` is absent (applies false).
- **Regression bar**: every existing CORRECT008 `ssr = false` opt-out test
  passes unchanged through the renamed helper.
- Root `pnpm build` / `typecheck` / `test` / `lint` green.

## Known limitations (v1, documented in the rule docs)

- **Non-literal `ssr` values** (`export const ssr = dev`) are not evaluated —
  conservative miss.
- **Layout inheritance is not modeled**: a group layout
  (`src/routes/(app)/+layout.ts`) disabling SSR flags that one file, not
  every descendant route; only the root layout gets the app-wide message.
- A deliberate SPA will see one warning per `ssr = false` file — the intended
  remedies are the rule config or suppressions, not detection heuristics.
