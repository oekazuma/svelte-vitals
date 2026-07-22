# correctness/each-index-key: index used as each-block key — Design

Date: 2026-07-22
Status: Approved

## Problem

Svelte's best-practices doc (`documentation/docs/07-misc/01-best-practices.md`, "Each blocks") is explicit: "The key _must_ uniquely identify the object. Do not use the index as a key." An index key (`{#each items as item, i (i)}`) gives items position-based identity — exactly the bug class an unkeyed block has (element state, focus, and transitions stick to positions when the list reorders or items are inserted/removed) — but the visible key makes the block LOOK safe, so the bug is found later, usually in production. The existing `correctness/each-key` rule only catches unkeyed blocks.

Sourced from the Svelte best-practices survey (2026-07-22) — candidate B of three (A: stale prop derivation, C: reassign-only `$state` → `$state.raw` follow on their own branches).

## Rule

- **Id / title**: `correctness/each-index-key` / `Index used as each key`
- **Category / severity / scope**: `correctness` / factory default (`warning`, same as `each-key`) / component
- **Shape**: `componentRule` factory, file `packages/core/src/rules/correctness/each-index-key.ts` — a sister rule to `each-key`, kept separate for granular off/severity control (same granularity decision as PERF011/PERF013)
- label (pass message): `Item-keyed {#each}`
- message (per block): `{#each} is keyed by its index — identity follows position, exactly like an unkeyed block, but the key makes it look safe.`
- recommendation: `Key by a value that uniquely identifies the item, e.g. (item.id).`
- rationale: quotes the official guidance ("the key must uniquely identify the object; do not use the index"), explains position-stuck DOM state on reorder/insert/remove, and notes the masking effect versus unkeyed blocks.
- `applies`: components with at least one each block carrying the new fact flag; `bad`: those blocks' lines.
- Mutual exclusivity with `each-key`: `indexKey` is only ever set on blocks that HAVE a key, so a block never triggers both rules.

## Fact

`EachBlockFact` (in `packages/core/src/component.ts`) gains one optional field:

```ts
/** Set when the block's key expression is exactly its index binding (`{#each items as item, i (i)}`) — correctness/each-index-key. */
indexKey?: boolean;
```

Optional → zero churn for existing tests that build `EachBlockFact` literals.

## Detection (in `collectEachBlocks`, `packages/core/src/component-parse.ts`)

When an `EachBlock` node has both an index binding and a key expression: unwrap the key through TS wrappers (`satisfies`/`as`) at every recursion step, and set `indexKey: true` iff the (unwrapped) key expression is the index binding itself, or a trivial stringification of it:

- the bare `Identifier` matching the index name (`(i)`);
- `String(i)` — a call to the global `String` with exactly the (recursively-checked) index expression as its sole argument;
- `` `${i}` `` — a `TemplateLiteral` with exactly one interpolated expression (the recursively-checked index expression) and no literal text in any quasi;
- `i.toString()` — a zero-argument, non-computed `.toString()` call on the (recursively-checked) index expression.

`String(i as number)` and similar TS-wrapped variants also match, since the TS unwrap runs at each recursion step, not just the outermost one. (Verify the modern-AST shape during implementation: `node.index` carries the index binding, `node.key` the key expression; the existing `isConstantListEach` skip and `hasKey` computation stay untouched.)

Update (review-wave 2): the trivial coercions actually detected are `String(i)`, `Number(i)`, `` `${i}` ``, `i.toString()`, and `i + ''` (either operand order) — the shared `unwrapTs` helper unwraps TS wrappers, including non-null assertions (`i!`), at every recursion step.

Not detected (non-goals):

- Composite keys that contain the index alongside item data — `(item.id + '-' + i)`, ``(`${item.id}-${i}`)``: appending an index is sometimes a deliberate workaround for lists with duplicate items, where a bare item key would throw Svelte's duplicate-key error. This is a documented trade-off, not an unconditional endorsement — such a key still changes when an item moves position, so moved items are destroyed and recreated instead of tracked; a truly unique id is preferable when available. Never flagged either way.
- Stringifications of a non-index value (`String(item.id)`, `` `${item.id}` ``, `item.id.toString()`) — not position-based identity, so out of scope.
- Blocks without an index binding, unkeyed blocks (that's `each-key`'s job), constant-list each blocks (already skipped by the collector).
- Length-only lists (`Array(n)`, `[...Array(n)]`, `Array.from({ length: n })`) — placeholder/skeleton lists with a fixed, order-free shape a key cannot help. Skipped at the collector (`isIdentityFreeEach`), exempting BOTH `each-key` and `each-index-key`.

## Registration, docs, changeset

- Registration in the four standard places (grep for the export name, 5 hits).
- Docs: `docs/src/content/docs/rules/correctness/each-index-key.md` + ja mirror (standard schema; ja prose uses full-width parentheses).
- Changeset: minor for core / cli / vite / mcp.
- Rides the existing component channel — no CLI/vite producer changes.

## Testing

- **Parse unit**: `(i)` with index `i` → flag; `(item.id)` → no flag; keyed by a DIFFERENT identifier than the index (e.g. `(id)` where `id` isn't the index) → no flag; no index binding → no flag; unkeyed → `hasKey: false` and no `indexKey`; `satisfies`-wrapped key; renamed index (`as item, idx (idx)`) → flag.
- **Rule unit**: fires per flagged block with the pinned message/line; components without the flag emit no results (the applies gate short-circuits); verify a single component with one unkeyed and one index-keyed block triggers `each-key` once and `each-index-key` once (no overlap).
- **Integration**: existing component-channel wiring is already covered; docs-links gate enforces the doc pages.
- Final review: adversarial probes against built dist.
