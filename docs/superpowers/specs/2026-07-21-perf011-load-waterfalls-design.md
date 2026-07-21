# PERF011 / PERF013: Load waterfalls — Design

Date: 2026-07-21
Status: Approved

## Problem

SvelteKit's best-practices docs name request waterfalls in `load` functions as a primary performance hazard. Two distinct shapes:

1. **Dependent sequential awaits in a universal load** (`+page.ts` / `+layout.ts`): each await round-trips from the browser on client-side navigation, so a chain of N dependent requests costs N network round trips. The fix is structural — move the chain to a server load (`+page.server.ts`), where the hops run server-side.
2. **Independent sequential awaits** (universal or server load): the later await doesn't use the earlier results, so the requests serialize for no reason. The fix is local — start them together and `await Promise.all`.

The fixes differ, so these ship as **two rules** (maintainer decision): granular off-switching and severity control.

Sourced from the best-practices survey (2026-07-21) of `sveltejs/kit/documentation/docs/40-best-practices` — candidate A of three (SEO031 and PERF012 shipped first).

## Rules

|          | PERF011                                            | PERF013                                      |
| -------- | -------------------------------------------------- | -------------------------------------------- |
| title    | `Load waterfall`                                   | `Sequential independent awaits`              |
| category | `performance`                                      | `performance`                                |
| severity | `warning`                                          | `info`                                       |
| applies  | `kind === 'universal'` files with `dependentLines` | files of either kind with `independentLines` |
| shape    | `kitModuleRule` factory                            | `kitModuleRule` factory                      |

Both use the `kitModuleRule` factory; its `category` union widens to `'security' | 'seo' | 'performance'`.

- PERF011 message (per line): `Sequential dependent awaits in a universal load create a client-side request waterfall — each hop is a network round trip from the browser. Move this chain to a server load (+page.server.ts / +layout.server.ts), where the hops run server-side.`
- PERF013 message (per line): `This await does not use the results of the awaits before it — the requests run sequentially for no reason. Start them together and await them with Promise.all.`
- PERF013 is `info` deliberately: forward taint cannot see side-effect ordering (e.g. `await setLocale(); await fetchLocalized()`), so the parallelize suggestion stays advisory.
- Dependent chains in **server** loads are NOT flagged: they cannot be parallelized and are already server-side — there is no better placement to suggest.

Fix objects: PERF011 — description `Move the dependent await chain into a server load (+page.server.ts), where hops run server-to-server.` with a small before/after-style snippet; PERF013 — description `Start the independent requests together and await them with Promise.all.` with snippet `const [a, b] = await Promise.all([fetchA(), fetchB()]);`.

## Fact

`KitModuleFacts` (packages/core/src/kit-module.ts) gains one optional field, set only when at least one list is non-empty:

```ts
/** Sequential-await analysis of the exported `load` function (PERF011/PERF013): 1-based lines of awaits that depend on an earlier await's result, and of awaits independent of all earlier awaits. */
loadWaterfalls?: { dependentLines: number[]; independentLines: number[] };
```

Parsing stays kind-neutral (both lists always computed); the universal/server split is applied by the rules via the existing `kind` field.

## Detection (parser, in kit-module-parse.ts)

New function `collectLoadWaterfalls(program, wrapped): { dependentLines: number[]; independentLines: number[] }`, wired into `parseKitModuleFacts` (lines −1-shifted by the caller convention already used there).

### Target function

Only the exported `load` — inline `export function load` / `export const load = …` (function or arrow, `satisfies`/`as` unwrapped) or same-file alias export, resolved with the existing helpers (`unwrapExport`, `unwrapTs`, `collectTopLevelBindings`). `actions`, HTTP-method handlers, and hooks are out of scope.

### Statement scan

Walk the load body's **direct statements in order**, extending into the direct statements of `try` blocks (a `try`-wrapped load body is still straight-line). Do NOT descend into `if`/`else`, loops, `switch`, `catch`/`finally`, or nested functions.

### Await sites, in order

- `VariableDeclaration` with a declarator whose init (TS-unwrapped) is an `AwaitExpression` → site; the declarator's bound names (destructuring included, via the existing `addBoundNames`) become taint sources.
- `ExpressionStatement` whose expression (TS-unwrapped) is an `AwaitExpression` → site, no bindings.
- `ReturnStatement` whose argument subtree contains one or more `AwaitExpression`s → one terminal site (no bindings; can only be classified, never depended on).
- `await parent()` sites (callee resolves to the `parent` binding destructured from the load event, or a direct `parent()` call) are **excluded entirely** — neither classified nor taint sources' anchors, though the names they bind DO become taint sources (a later await using `await parent()`'s data is a real dependency on a Kit-managed step we chose not to judge; treating its bindings as taint prevents misclassifying such awaits as independent).
- Response-body-parse sites — a zero-argument `.json()`/`.text()`/`.blob()`/`.arrayBuffer()`/`.formData()`/`.bytes()` member call (`res.json()`) — are excluded the same way as `await parent()`: not classified as a hop (reading an already-received body costs no extra round trip), but the bindings they feed still taint (data parsed from the body IS derived from the earlier request). A same-named call WITH arguments (`db.json("users")`) is not exempt and is classified normally.
- A statement with multiple/nested awaits (`await f(await g())`) is one site.

### Taint propagation and classification

- Maintain a tainted-name set, seeded by each await site's bound names.
- A non-await `VariableDeclaration` whose init references a tainted name taints its own bound names (forward transitivity through intermediate consts).
- An `ExpressionStatement` whose expression is a plain `=` `AssignmentExpression` (e.g. `user = await fetch(...).then(...)` inside a `try`, or a later `key = res.key`) taints its left-hand-side's bound names the same way, when its right-hand side contains an await or already references a tainted name — otherwise a `try`-wrapped chain's target, or a plain reassignment from a tainted value, would never taint and a real dependency downstream would be misclassified independent.
- For each await site after the first, collect the identifiers referenced in its expression subtree, threading nested-function shadowing with the existing scope machinery (`scopeIntroducedNames`-style), so a callback parameter that shadows a tainted name does not create a false dependency. Property keys and member-expression property names don't count as references.
- References ∩ tainted ≠ ∅ → push the site's line to `dependentLines`; otherwise (and at least one earlier non-excluded await site exists) → push to `independentLines`.
- Reassignment of a tainted `let` to an untainted value is ignored (stays tainted) — over-approximation toward "dependent", which is the conservative direction for PERF013; for PERF011 it is mitigated by the shadow-threading above and by straight-line scope (plain reassignment between awaits is rare in load bodies).

### Not detected (summary)

Single-await loads; awaits inside `if`/loops/`switch`/`catch`/nested closures; `await parent()` itself; dependent chains in server loads (fact recorded, rule filters); files without a `load` export; malformed sources (existing pipeline behavior: `parseKitModuleFacts` may throw, and `collectKitModuleFacts`'s catch yields empty facts).

## Suppression

`kitModuleRule` already applies inline `svelte-vitals-disable-next-line` suppressions by line — both rules inherit that for free.

## Registration, docs, changeset

- Two rule files: `packages/core/src/rules/perf/perf011-load-waterfall.ts`, `packages/core/src/rules/perf/perf013-sequential-awaits.ts`; four registration places each (grep `perf011LoadWaterfall` / `perf013SequentialAwaits`, 5 hits each).
- Docs: `docs/src/content/docs/rules/perf011.md`, `perf013.md` + ja mirrors (standard schema; PERF013's page documents the side-effect-ordering caveat and the info severity rationale; both pages document the straight-line/`try`-only scan).
- Changeset: minor for core / cli / vite / mcp.
- Both rules ride the existing kit-module channel — CLI and vite build mode pick them up with **no producer changes**.

## Testing

- **Parser unit** (extend `packages/core/test/kit-module-parse.test.ts` or a new `load-waterfalls.test.ts`): dependent chain (direct + through an intermediate const + destructured names); independent pair; mixed function (one dependent + one independent site); `await parent()` excluded but its bindings taint; shadowed callback param not a dependency; `try`-block statements scanned; `if`-block awaits ignored; return-position await classified; alias-exported load resolved; no-load file → field unset; malformed → unset.
- **Rule unit**: PERF011 fires only for `kind: 'universal'`; PERF013 fires for both kinds; lines and messages pinned; severities warning/info.
- **CLI integration**: fixture route with a universal load containing both patterns → both findings with correct lines; server-load fixture with a dependent chain → no PERF011, and with an independent pair → PERF013.
- Final review: adversarial probes against built dist with realistic load functions.
