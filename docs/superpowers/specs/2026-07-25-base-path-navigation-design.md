# correctness/base-path-navigation: hardcoded root-relative links under kit.paths.base — Design

Date: 2026-07-25
Status: Approved

## Problem

A SvelteKit app configured with `kit.paths.base` is served from a sub-path (`/docs`, `/repo-name`).
Root-relative navigation written as a literal — `<a href="/about">`, `goto('/about')`,
`redirect(303, '/login')` — resolves against the **domain root**, not the base, so it lands
outside the app and 404s in production. The official configuration docs state this outright:
"you need to prepend all your root-relative links with the base value or they will point to the
root of your domain, not your `base` (this is how the browser works)."

The failure is invisible locally. Base paths are usually applied only in the deployed
environment (`base: dev ? '' : '/repo'` is the standard GitHub Pages form), so dev and most tests
exercise `base === ''`, where every hardcoded link works. Nothing in the toolchain catches it:
the Svelte compiler sees a plain attribute, and `svelte-check` type-checks the string, not its
runtime meaning.

Sourced from the 2026-07-24 rule-candidate survey — candidate B of three (A:
`correctness/nonreactive-builtin-state`, #285; C: `correctness/checkable-bind-value`, #299).

### Empirical verification

Checked against the installed SvelteKit 2.70.1 and the official docs before designing:

- **`goto` does not prefix `base`.** `packages/.../kit/src/runtime/client/client.js:2333` resolves
  the argument with `new URL(resolve_url(url))` — plain URL resolution against the current
  location. `goto('/about')` under base `/docs` targets `/about`, outside the app.
- **`redirect` emits the string as the `Location` header** — same breakage, server-side.
- **Config has two homes.** `sveltekit(config)`
  (`kit/src/exports/vite/index.js:150`, typed `KitConfig & …`) accepts SvelteKit options directly
  since 2.62.0, and when it receives an argument it **ignores `svelte.config.js`** and warns:
  `` `${config_file} is ignored when options are passed via your Vite config` ``. In that form kit
  options sit at the top level — `paths: { base }`, no `kit:` wrapper. This repository's own
  `packages/cli/src/discover-apps.ts` already notes that current `sv create` output folds
  SvelteKit config into `vite.config.ts` and emits no `svelte.config` file, so a gate reading only
  `svelte.config` would never open on a freshly scaffolded project.
- **`resolve()` is the current fix.** `$app/paths` exports `resolve()` (since 2.26); `base` and
  `resolveRoute` are both marked deprecated in favour of it, and `asset()` supersedes `assets`.

## Rule

- **Id / title**: `correctness/base-path-navigation` / `Root-relative navigation under a base path`
- **Category / severity / scope**: `correctness` / `warning` / component
- **Shape**: custom `Rule` (not the `componentRule` factory — the facts live on BOTH the
  component and Kit-module channels, and the rule is gated on a project fact). File
  `packages/core/src/rules/correctness/base-path-navigation.ts`. Precedent:
  `correctness/orphan-lifecycle`, which is a custom dual-channel rule for the same reason.
- **Severity rationale**: `warning`, not `critical`. This codebase reserves `critical` for
  runtime crashes (`orphan-effect`, `server-browser-global`, `orphan-lifecycle` all throw); a
  base-path link is a broken navigation, not a crash, and the dynamic-`base` gate below carries
  a small residual false-positive risk that should not fail CI by default.
- **Result emission**: follows `orphan-lifecycle` exactly — a file with no root-relative literal
  contributes nothing (no PASS seeding), so clean projects and gate-closed projects produce an
  empty result set. A file whose every finding is suppressed emits one PASS
  (`Base-path-aware navigation`) instead.
- **Messages** (per `kind`):
  - `href`: `<a href="<path>"> is root-relative — under this project's kit.paths.base it points at the domain root, outside the app, and 404s in production. Use resolve('<path>') from '$app/paths'.`
  - `goto`: `goto('<path>') is root-relative — it navigates outside this project's kit.paths.base and 404s in production. Use goto(resolve('<path>')) with resolve from '$app/paths'.`
  - `redirect`: `redirect(…, '<path>') is root-relative — the Location header points outside this project's kit.paths.base and 404s in production. Use resolve('<path>') from '$app/paths'.`
- **recommendation**: `Wrap root-relative paths in resolve() from '$app/paths' so they resolve against kit.paths.base.`
- **rationale**: `A root-relative literal resolves against the domain root, not kit.paths.base, so
navigation lands outside an app served from a sub-path. The break only appears once the app is
deployed under its base — locally base is usually '', so every such link works.`
- **fix (description-only)**: `Import { resolve } from '$app/paths' and wrap the path:
href={resolve('/about')}, goto(resolve('/about')), redirect(303, resolve('/login')).`

## Gate: the `kitPathsBase` project fact

`Project` (`packages/core/src/types.ts`) gains an optional fact. Its **presence is the gate** —
no fact, no findings, ever.

```ts
/**
 * Set when the project configures a non-empty `kit.paths.base` — from the `sveltekit()` Vite
 * plugin config, else `svelte.config.{js,ts}` (correctness/base-path-navigation).
 * `value` is the literal base when statically resolvable, unset when the config computes it
 * (e.g. `dev ? '' : '/repo'`). `file` is the config path relative to the analyzed root (posix).
 */
kitPathsBase?: { value?: string; file: string };
```

`defaultProject` does not list it (optional, absent by default) — matching `viteMinifyDisabled`.

### Resolution order (mirrors SvelteKit's own)

1. Read the first existing Vite config, in Vite's own resolution order. That list currently lives
   as a private `VITE_CONFIG_FILES` const inside the CLI provider; since the Vite provider now
   needs the same order, it moves to `packages/core/src/project-paths.ts` (the existing home for
   exactly this kind of shared path data) and both providers import it. Resolve its exported
   object, take `plugins`, and find a
   `CallExpression` whose callee is the local name bound to the `sveltekit` import from
   `@sveltejs/kit/vite` (alias-resolved; a bare `sveltekit` identifier with no matching import is
   also accepted, since that is what an unparsed-import config looks like).
   - `sveltekit(<resolvable object>)` → that object IS the kit config. Read `paths.base` from its
     TOP level (no `kit:` wrapper). **`svelte.config` is not consulted**, exactly as SvelteKit
     behaves.
   - `sveltekit()` with no argument → fall through to step 2.
   - `sveltekit(<unresolvable argument>)` (imported identifier, spread, function call) → the
     effective config is unknowable AND `svelte.config` is provably ignored → **fact undefined,
     gate closed**. Conservative by construction: quiet beats wrong.
2. Read `svelte.config.js`, else `svelte.config.ts`. Resolve the exported object and read
   `kit.paths.base`.

### When the gate opens

| `base` as written                                                             | Fact                       | Rationale                                                                                                                                                             |
| ----------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| absent                                                                        | undefined                  | app is served at the root                                                                                                                                             |
| `''` (literal)                                                                | undefined                  | explicitly root — flagging would be pure noise                                                                                                                        |
| `'/docs'` (literal)                                                           | `{ value: '/docs', file }` | confident                                                                                                                                                             |
| any other expression (`dev ? '' : '/repo'`, `process.env.BASE_PATH ?? ''`, …) | `{ file }`                 | writing `paths.base` at all means the app is served under a base in at least one environment; the standard GitHub Pages deploy form lives here and must not be missed |

The dynamic case is the deliberate precision trade-off: a project that declares `paths.base` but
always resolves it to `''` would get findings it does not need. That shape is not a realistic
pattern, and the rule is a `warning` with a documented escape hatch (config `'off'`, or an inline
`svelte-vitals-disable-next-line`).

### Machinery

`propOf`, `findExportedExpression`, `unwrapToObjectExpression`, and `resolveConfigObject` in
`packages/core/src/vite-config-parse.ts` are generic config-object resolution, and the new parser
needs all four. Rather than add a third near-identical copy, they move to a new pure module
`packages/core/src/config-object.ts`; `vite-config-parse.ts` imports them instead of defining
them. Behaviour-preserving, and the existing `findMinifyDisabled` tests protect the move.

The new parser lives in `packages/core/src/svelte-config-parse.ts`, exporting:

```ts
/** `kit.paths.base` from a svelte.config source. */
export function findKitPathsBaseInSvelteConfig(source: string): { value?: string } | undefined;
/** `paths.base` from a `sveltekit({...})` call in a Vite config source. */
export function findKitPathsBaseInViteConfig(source: string): { value?: string } | 'ignored-config' | undefined;
```

`'ignored-config'` is the step-1 "unresolvable argument" signal that stops the caller from falling
back to `svelte.config`. Both return `undefined` for absent/empty/unparsable input and never throw
(same contract as `findMinifyDisabled`).

### Producers

Both channels call the same pure functions — there is no resolved-value shortcut for this fact
because SvelteKit's resolved Kit config is not exposed to third-party Vite plugins, and reading
`svelte.config` at runtime would be wrong for plugin-hosted configs anyway.

- CLI: `detectKitPathsBase(rt, cwd)` in `packages/cli/src/providers/source/project.ts`, wired into
  `collectProjectFacts`.
- Vite: the same read in `packages/vite/src/providers/rendered/project.ts`
  (`collectRenderedProject`), so build-mode analysis gates identically.

## Detection

### The predicate, and why base-awareness needs no detection

Only **fully static literals** are considered. This makes the issue's "not already `base`-prefixed
or `resolve()`-wrapped" requirement fall out for free:

- `href="{base}/about"` / `href={resolve('/about')}` — the attribute contains an `ExpressionTag`,
  so `attrTextOf` returns `undefined` and the element is skipped.
- ``goto(`${base}/about`)`` / `goto(resolve('/about'))` — the argument is a `TemplateLiteral` /
  `CallExpression`, not a string `Literal`, so it is skipped.

What remains is a single predicate on a known string:

> flagged ⟺ starts with `/` AND does not start with `//`

`//cdn.example.com` is a protocol-relative external URL and is excluded by the second clause.
`#anchor`, `?q=1`, `./rel`, `https://…`, and `mailto:…` never start with `/`.

`/` alone (`<a href="/">`) IS flagged: under a base path the app root is `/base/`, so a bare `/`
leaves the app like any other root-relative link.

### Facts

Both channels carry the same shape, discriminated by `kind` (the `checkable-bind-value`
convention):

```ts
/** A root-relative navigation literal — broken when the app is served under kit.paths.base
 *  (correctness/base-path-navigation). */
export interface BasePathLinkFact {
  /** Which navigation surface it was written on — selects the message wording. */
  kind: 'href' | 'goto' | 'redirect';
  /** The literal path as written, e.g. '/about'. */
  path: string;
  /** 1-based source line, or 0 if unknown. */
  line: number;
}
```

- `ComponentFacts.basePathLinks: BasePathLinkFact[]` — `href` from `.svelte` templates, `goto`
  from the instance/module scripts and template inline handlers of `.svelte` files and from
  `.svelte.ts`/`.svelte.js` runes modules.
- `KitModuleFacts.basePathLinks: BasePathLinkFact[]` — `redirect` in `+page.server.ts`,
  `+layout.server.ts`, `+server.ts`, `+page.ts`, `+layout.ts`, and hooks.

### `href`

Template walk over `RegularElement` nodes named `a` (the `collectSecurityFacts` shape). Read the
`href` attribute with `findAttr` + `attrTextOf`; apply the predicate. `<svelte:element this="a">`
is out of static reach and skipped, as are all non-`<a>` elements.

### `goto` and `redirect`

Both are "resolve an imported callee, then check a literal argument":

- `goto` — named import of `goto` from `$app/navigation` (alias-resolved), argument index 0.
- `redirect` — named import of `redirect` from `@sveltejs/kit` (alias-resolved), argument index 1
  (index 0 is the status code).

`collectBrowserGuardImports` (`component-parse.ts`) is exactly this shape for a single name from
`$app/environment`. It is generalized into

```ts
/** Local names bound to `names` value-imported from `moduleSource` (alias-resolved). */
export function collectNamedImportAliases(program: Node, moduleSource: string, names: Set<string>): Set<string>;
```

with `collectBrowserGuardImports` kept as a thin wrapper so its callers and tests are untouched.
Namespace imports (`import * as nav from '$app/navigation'; nav.goto('/x')`) are NOT resolved in
v1 — a documented miss, consistent with how the guard-import collector already behaves.

### Not detected (documented limitations)

`<form action="/…">`; static assets (`<img src="/logo.png">`, `<link href>`) — real breakage but
the fix is `asset()` from `$app/paths`, a different remedy, deferred to a follow-up; `fetch('/api/…')`;
dynamic `href`/arguments of any kind (including `` `/${slug}` `` and a zero-substitution
`` `/about` `` template literal); `<svelte:element this="a">`; namespace-imported `goto`/`redirect`;
projects whose `sveltekit()` plugin argument cannot be statically resolved.

## Registration, docs, changeset

- Four standard registration places (`packages/core/src/rules/index.ts` import + `allRules` +
  re-export block, and `packages/core/src/index.ts`'s re-export list).
- Core's public surface additionally exports the new parser functions and `BasePathLinkFact`,
  since the CLI and Vite providers consume them (mirrors `findMinifyDisabled`).
- Docs: `docs/src/content/docs/rules/correctness/base-path-navigation.md` + the `ja/` mirror.
  Both must cover: what opens the gate (including the dynamic-`base` decision and the
  vite.config-vs-svelte.config precedence), the three surfaces, the `resolve()` fix, and the
  limitations list above.
- Changeset: minor × `@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/vite`,
  `@svelte-vitals/mcp`.

## Testing

- **Config parser unit** (`svelte-config-parse`): `kit.paths.base` literal / `''` / absent /
  dynamic in `svelte.config`; the same four in a `sveltekit({...})` Vite config; `defineConfig`
  and same-file-alias wrappers; `sveltekit()` with no argument → falls through; `sveltekit(imported)`
  → `'ignored-config'`; malformed source → `undefined`, no throw.
- **`config-object` move**: existing `findMinifyDisabled` tests must pass unchanged (the move is
  behaviour-preserving by definition).
- **Component parse unit**: `<a href="/about">` recorded as `href`; `href="/"` recorded;
  `href="//cdn.example.com/x">`, `href="#top"`, `href="?q=1"`, `href="./rel"`,
  `href="https://example.com"`, `href="{base}/about"`, `href={resolve('/about')}` not recorded;
  `<svelte:element this="a" href="/about">` not recorded; `goto('/about')` in a handler recorded
  as `goto`; aliased `import { goto as nav }` recorded; `goto(resolve('/about'))` and
  ``goto(`${base}/x`)`` not recorded; `goto` imported from elsewhere not recorded.
- **Kit-module parse unit**: `redirect(303, '/login')` recorded as `redirect` with the argument-1
  path; `redirect(303, resolve('/login'))` not recorded; aliased import recorded; `redirect` from a
  non-Kit module not recorded.
- **Rule unit**: gate closed (`project.kitPathsBase` undefined) with facts present → **no results
  at all**; gate open via literal base → one finding per fact with the kind-specific message,
  severity `warning`, correct line/location; gate open via dynamic base (`{ file }` only) → same;
  facts from both channels in one run → both reported; registration + `explainRule` severity.
- **Provider unit**: CLI `collectProjectFacts` and Vite `collectRenderedProject` both produce the
  fact from a fixture with a base, and both omit it for a fixture without one, including the
  vite.config-hosted shape and the precedence case (both files present, plugin form wins).
