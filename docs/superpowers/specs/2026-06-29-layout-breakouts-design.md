# Layout breakouts — `+page@` / `+layout@` resolution

**Date:** 2026-06-29
**Status:** Approved (per maintainer)
**Packages:** `@svelte-vitals/cli` (static route resolver)
**Issue:** #12

## Goal

Resolve SvelteKit layout **breakouts** in the static (CLI) provider so analysis
matches the real layout hierarchy. Two gaps today:

1. **Breakout pages are not even enumerated.** `enumerateRoutePages` globs
   `**/+page.svelte`, which never matches `+page@.svelte` / `+page@x.svelte`, so
   those routes get **zero analysis**.
2. **`chainFiles` ignores `@`.** It always includes every ancestor `+layout.svelte`,
   so a route that breaks out inherits the wrong layouts (false inherited tags).

## SvelteKit semantics (from kit/advanced-routing)

- `+page@seg.svelte` resets the page's layout to the `+layout.svelte` in the
  ancestor directory whose segment name is `seg` (`@` = the **root** layout).
  `seg` matches a literal path segment, including groups `(app)` and params `[id]`.
  Layouts between `seg` and the page are skipped.
- `+layout@seg.svelte` resets **that layout's** parent the same way; its own
  children then inherit through the reset chain.
- The route URL is derived from the directory only — `@seg` never affects the URL.

Example (`(app)/item/[id]/embed/+page@(app).svelte`) inherits root +
`(app)/+layout.svelte` + the page, skipping `item` and `[id]` layouts.

## Design (`packages/cli/src/providers/source/`)

### Enumeration (`project.ts`)

`enumerateRoutePages` globs both `**/+page.svelte` and `**/+page@*.svelte`, merged
and sorted.

### Layout index (`routes.ts`)

`collectLayouts(rt, cwd)` globs `**/+layout.svelte` + `**/+layout@*.svelte` and
returns `Map<dirRel, filename>` (a directory has one layout). Built once per run.

### Breakout-aware chain (`routes.ts`, now pure)

`chainFiles(pageRel, layouts)` returns `[{rel,isPage:false}...root-first, {rel:pageRel,isPage:true}]`:

- `parseAt(filename)` → the `@`-segment (`''` for `@`, `null` for no `@`).
- `atTarget(filename, dirSegs)` → directory segments to attach to: `null` (default
  = own dir), `[]` (root), or the prefix up to the **last** segment equal to the
  `@`-segment (not found → fall back to default, never crash).
- `buildChain(attachSegs)` walks upward from the attach dir: find the nearest
  layout at-or-above the current dir, prepend it, then continue from its parent —
  **unless that layout is itself `+layout@seg`**, in which case jump to `seg`'s
  dir. A `seen` set guards against cycles.
- The page's own `@` chooses the initial `attachSegs`.

`deriveRoute(pageRel)` strips from the last `/+page` (so `+page@x.svelte` works)
and drops `(group)` segments — URL unchanged by breakouts.

`collectRoutes` builds the layout index once and passes it to each `resolveRoute`
(which becomes sync-chain + per-file read, no per-ancestor `exists()`).

## Testing

- `chainFiles` unit (with a layout map): default chain unchanged; `+page@`
  (root), `+page@seg`, `+page@(group)`, `+page@[param]`; `+layout@` reset skips an
  intermediate layout; unknown `@seg` falls back; cycle guard.
- `deriveRoute`: `+page@(app).svelte` etc. yield the directory's route.
- `enumerateRoutePages`: `+page@x.svelte` is enumerated.
- Integration (`collectRoutes`, memory runtime): a breakout page inherits the
  reset chain (correct inherited vs skipped tags).
- Full `pnpm -r test` + typecheck + lint green.

## Out of scope

- Rendered (vite) mode already reads final HTML, so breakouts don't apply there.
- Param-matcher / encoding edge cases unrelated to layout inheritance.
