# seo/heading-level-skip — headings in document order, components as predecessors only (2026-09-29)

Source analysis reads a route's headings in document order: each heading carries `HeadingInfo.order`,
the source offsets of its placements from the route's outermost file down (a layout's
`{@render children()}`/`<slot />`, a component's tag, a snippet's `{@render}`), then its own. Before
this, a route file's headings were read layout-first — a layout heading written after its children
came before every page heading — and headings in child components were not read at all, which was the
false-positive class holdouts 4, 6 and 9 kept finding (a component's `<h2>` before the page's `<h3>`).

## Decision

A child component's heading is placed in the outline and can be the heading before a route file's
heading, but it is never the one reported, and only where it renders whenever that heading does: its
`{#if}`/`{#await}` arm path must be contained in the flagged heading's. A heading in a closed dialog,
drawer or menu therefore closes no gap. An `{#each}` body is a one-arm block (the list may be empty). When the heading
before sits in one arm of a block, every arm is a rendering: the last heading of each other arm is also
compared, and the lowest level is the one the flagged heading is judged against — except when that
heading repeats in an `{#each}` the flagged one is outside, where the arm of the last pass depends on the
data (a list of typed sections, say) and only the nearest heading counts.

## Rejected: reporting a skip at a component's heading

Measured on the corpus (139 apps), letting a component heading be the reported one added about 400
findings across 98 apps and hid most pages' own findings:

- The rule reports the first skip per route. Layout chrome (header, burger menu, settings panel)
  sorts before the page, so its skip became every route's one finding — one component-anchored key
  with `routes` = N — and masked the page's own skip on each route.
- Most of the new anchors were headings in dialogs, drawers and menus behind `{#if}`. Under the
  "separate blocks all render" approximation they count as rendering, which is noise for an outline
  rule.

Reporting there would need two further decisions — reporting per file (or every skip) instead of the
first per route, and a stance on headings in conditional dialogs and menus — and several hundred
`info` findings to label. It is left out until those are decided.

## Rejected: dropping a component heading that skips a level itself

A page `<h1>`, a component's unconditional `<h4>`, then the page's `<h3>`: the outline skips at the
`<h4>`, which the rule does not report. Dropping self-skipping component headings brought back the
page's "h1 to h3" there, a right claim at the wrong anchor, and cascaded: every later heading of that
component was compared with the same stale `<h1>`, dropped in turn, and the next page heading reported
against it (7 corpus false positives in one pass). The page heading is left unreported instead.

## Known limits

- A `<svelte:element>` whose level the source does not determine sits in the outline as level 0: it
  closes any gap, and the heading after it is not judged. A shadcn-style `CardTitle` whose `this={tag}`
  defaults to `div` is read this way, so a skip right after one goes unreported.

- A component's headings sit at its tag, so content passed into it sorts after them even when the
  component renders its own heading after `{@render children()}`.
- A layout that renders `{@render children()}` in two places is placed at the first.
- A snippet rendered inside another snippet sits at the inner `{@render}`, not where the outer one
  renders.
