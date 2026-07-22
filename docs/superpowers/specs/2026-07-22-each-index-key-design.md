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

When an `EachBlock` node has both an index binding and a key expression: unwrap the key through TS wrappers (`satisfies`/`as`), and set `indexKey: true` iff the result is an `Identifier` whose name equals the block's index binding name. (Verify the modern-AST shape during implementation: `node.index` carries the index binding, `node.key` the key expression; the existing `isConstantListEach` skip and `hasKey` computation stay untouched.)

Not detected (non-goals):

- Wrapped forms — `(String(i))`, ``(`${i}`)``: rare, exact-identifier only in v1.
- Composite keys containing the index — `(item.id + '-' + i)`: appending an index to add uniqueness is a legitimate pattern; never flagged.
- Blocks without an index binding, unkeyed blocks (that's `each-key`'s job), constant-list each blocks (already skipped by the collector).

## Registration, docs, changeset

- Registration in the four standard places (grep for the export name, 5 hits).
- Docs: `docs/src/content/docs/rules/correctness/each-index-key.md` + ja mirror (standard schema; ja prose uses full-width parentheses).
- Changeset: minor for core / cli / vite / mcp.
- Rides the existing component channel — no CLI/vite producer changes.

## Testing

- **Parse unit**: `(i)` with index `i` → flag; `(item.id)` → no flag; keyed by a DIFFERENT identifier than the index (e.g. `(id)` where `id` isn't the index) → no flag; no index binding → no flag; unkeyed → `hasKey: false` and no `indexKey`; `satisfies`-wrapped key; renamed index (`as item, idx (idx)`) → flag.
- **Rule unit**: fires per flagged block with the pinned message/line; components without the flag emit pass results only; verify a single component with one unkeyed and one index-keyed block triggers `each-key` once and `each-index-key` once (no overlap).
- **Integration**: existing component-channel wiring is already covered; docs-links gate enforces the doc pages.
- Final review: adversarial probes against built dist.
