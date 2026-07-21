# PERF012: Minification disabled — Design

Date: 2026-07-21
Status: Approved

## Problem

A `build.minify: false` override left in `vite.config.*` (added while debugging a production issue, then forgotten) ships unminified JS/CSS to production. Bundles grow several-fold, hurting load time on every route. Nothing in the SvelteKit toolchain warns about it: the build succeeds, dev is unaffected, and the regression only shows up as slow production pages. This is exactly the "catch it before deploy" class svelte-vitals targets.

Sourced from the best-practices survey (2026-07-21) of `sveltejs/kit/documentation/docs/40-best-practices` — candidate C of three (SEO031 shipped first; PERF011 load waterfalls follows on its own branch).

## Scope decision

Detect **only** literal `build.minify: false`. Other debug leftovers (e.g. `build.sourcemap: true`) are excluded: sourcemaps in production are a common deliberate choice (error-tracker integration), so flagging them would be noisy. Maintainer confirmed minify-only.

## Rule

- **Id / title**: `PERF012` / `Minification disabled`
- **Category / severity / scope**: `performance` / `warning` / `project`
- **Shape**: plain `Rule` object (same pattern as the project-scope SEO rules in `seo/project-rules.ts`), file `packages/core/src/rules/perf/perf012-minify-disabled.ts`. First project-scope Performance rule; no factory needed.
- **check()**: if `ctx.project.viteMinifyDisabled` is set, return one finding at `{ file, line }`:
  - message: `JS/CSS minification is disabled (build.minify: false) — production bundles ship unminified and several times larger. Remove the override, or scope it to non-production builds if it is intentional.`
- Severity is `warning`, not `critical`: disabling minify has rare legitimate uses (temporary debugging, readability requirements), and the site still works.

## Fact

`Project` (in `packages/core/src/types.ts`, alongside `hasRobotsTxt` etc.) gains one optional field:

```ts
/** Set when the Vite config disables minification for production builds. */
viteMinifyDisabled?: { file: string; line: number };
```

`file` is the project-relative path of the Vite config that carries the override (e.g. `vite.config.ts`); `line` is 1-based. Optional field → no fixture churn for existing tests that build `Project` objects.

## Shared parser (core, pure)

New module `packages/core/src/vite-config-parse.ts`:

```ts
export function findMinifyDisabled(source: string): { line: number } | undefined;
```

- Parses via the existing wrap-parse trick (reuse the shared wrap helper used by kit-module parsing: `'<script lang="ts">\n' + source + '\n</script>'` through `svelte/compiler` `parse()`, `</script` neutralized with the same-length `<_script` replacement, reported lines shifted by −1 with `Math.max(0, line - 1)`).
- Resolves the exported config object:
  - `export default { … }` — direct object literal
  - `export default defineConfig({ … })` — any `CallExpression` whose first argument is an object literal is unwrapped (the callee name is not verified; a `build.minify: false` literal inside whatever is exported is still the smell)
  - `const config = { … }; export default config` — same-file alias resolution, same approach as `findSsrFalseOptOut`
  - `satisfies` / `as` expressions are unwrapped at every step
- Within the resolved object: property `build` (non-computed `Identifier` or string-literal key) whose value is an object literal, containing property `minify` whose value is the **literal `false`** → return `{ line }` of the `minify` property. Unlike `findSsrFalseOptOut` (which receives an already-wrapped program and returns wrapped-source lines for its caller to shift), `findMinifyDisabled` takes the raw source and wraps internally, so it applies the −1 shift itself and returns lines in the original source's coordinates — callers use the value as-is.
- Returns `undefined` for everything else. Explicitly **not** detected:
  - function-form configs (`defineConfig(({ mode }) => …)`)
  - non-literal values (`minify: mode !== 'development' ? 'esbuild' : false`, `minify: DEBUG`, …)
  - `minify: 'esbuild' | 'terser' | true`
  - `minify` keys outside the `build` object (nested plugin options etc.)
  - unparsable sources → `undefined` (never throw), consistent with the malformed-file behavior of the kit-module parser

No `node:` imports, no I/O — callers read the file and pass the source string (core purity, design §8).

## Producers

### CLI (`collectProjectFacts`, `packages/cli/src/providers/source/project.ts`)

- Look for the Vite config in the analyzed app directory (the same `cwd` the rest of project-fact collection uses, so monorepo `--app` resolution is inherited) using **Vite's own resolution order**: `vite.config.js`, `vite.config.mjs`, `vite.config.ts`, `vite.config.cjs`, `vite.config.mts`, `vite.config.cts`. Analyze only the first file that exists (the one Vite would load).
- Read it through the injected `Runtime`, call `findMinifyDisabled`, and set `project.viteMinifyDisabled = { file: '<basename as project-relative path>', line }` on a hit.
- No Vite config present → field stays unset (not a finding; plain Vite-less setups aren't the target and SvelteKit projects without a vite config use defaults, which minify).

### Vite plugin (`packages/vite/src/plugin.ts`)

- In the existing `configResolved(config)` hook, capture `config.build.minify === false` and `config.configFile`.
- At analyze time (build mode, `closeBundle`), when captured: read the config file source (node fs is fine in this package), call the same `findMinifyDisabled` to locate the line; if the parser finds nothing (dynamic config that still resolves to `false`), fall back to `line: 1`. Set `project.viteMinifyDisabled` with the config file path relative to the project root (fallback `vite.config.js` if `configFile` is somehow unset).
- Because this channel sees the **resolved** value, it also catches function-form and conditional configs the CLI skips — and never false-positives on overrides that don't apply to the actual build.

The asymmetry (plugin = exact resolved value; CLI = conservative literal-only static analysis) is documented in the rule page's Limitations section.

## Registration

Standard four places, verified with a grep for `perf012` / `perf012MinifyDisabled` expecting 5 hits:

1. `packages/core/src/rules/perf/perf012-minify-disabled.ts` (the rule)
2. `packages/core/src/rules/index.ts` — import, `allRules` entry, re-export
3. `packages/core/src/index.ts` — named re-export (the untypechecked fourth place)

Plus `findMinifyDisabled` exported from core for the CLI/vite producers (same export path pattern as the kit-module parse helpers).

## Docs & changeset

- `docs/src/content/docs/rules/perf012.md` + `docs/src/content/docs/ja/rules/perf012.md` (standard schema: チェック内容/重要な理由/修正方法, severity/category line). Limitations section covers the CLI/plugin asymmetry and the function-form skip.
- Changeset: minor for `@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/vite`, `@svelte-vitals/mcp` (same shape as SEO031's).

## Testing

- **core / parser unit** (`packages/core/test/vite-config-parse.test.ts`): direct object, `defineConfig(…)`, same-file alias, `satisfies`, string-literal `'build'` key, correct line numbers; negatives: function form, ternary/identifier values, `'terser'`/`'esbuild'`/`true`, `minify` outside `build`, no default export, malformed source (no throw).
- **core / rule unit**: `RuleContext` with and without `viteMinifyDisabled` → one finding / none; message and severity pinned.
- **cli integration**: fixture app with `vite.config.ts` containing `build.minify: false` → PERF012 appears with the right file/line; sibling fixture without the override → absent. Resolution-order case: both `vite.config.js` (clean) and `vite.config.ts` (bad) present → no finding (Vite loads the `.js` one).
- **vite plugin**: test the captured-flag → fact path following the package's existing test structure (unit-level around the hook logic; line fallback to 1 for a dynamic config).
- Docs presence auto-enforced by `packages/cli/test/docs-links.test.ts`.

## Not flagged (summary)

- `build: { minify: 'terser' | 'esbuild' | true }`
- Function-form / conditional configs in the CLI channel (plugin channel resolves them)
- `minify: false` outside `build`
- Projects without a Vite config
- Commented-out overrides (not in the AST)
