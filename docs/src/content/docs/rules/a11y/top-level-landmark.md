---
title: a11y/top-level-landmark · Top-level landmark
description: A banner, main, complementary, or contentinfo landmark should not be nested inside another landmark.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags a `banner`, `main`, `complementary`, or `contentinfo` landmark that ends up nested inside another landmark once a route's composed layout chain (every `+layout.svelte` up to the route's `+page.svelte`) and its resolved local components are put together.

The flagship case is a layout that renders its children inside `<main>` while the page contributes another landmark, e.g. an `<aside>` with `role="complementary"`:

```svelte +layout.svelte
<header>Site navigation</header><main><slot /></main>
```

```svelte +page.svelte
<h1>Page content</h1><aside role="complementary">Related links</aside>
```

Nothing in either file alone is wrong — a file-scoped markup linter cannot see this, since the nesting only exists once the layout's `<main>` and the page's `complementary` are composed across files.

Not flagged:

- A route with no `banner`/`main`/`complementary`/`contentinfo` landmark at all.
- Nesting through an intermediate, non-landmark component: if `+page.svelte` places `<Sidebar />` inside `<main>`, and `Sidebar.svelte` itself renders `role="complementary"`, that nesting is out of scope — detection is counting-only per file, plus the direct layout-`<slot>` case, not a full call-graph trace through every intermediate component.

## Why it matters

Assistive technology exposes `banner`, `main`, `complementary`, and `contentinfo` as landmarks a user jumps between with a keystroke, on the assumption each is a distinct, top-level region of the page. A landmark nested inside another loses that meaning: it disappears from landmark navigation, or reads as content of the outer landmark instead of the region it's meant to be.

## How to fix

Move the nested landmark out so every landmark composes at the top level of the route:

```svelte +layout.svelte
<header>Site navigation</header><main><slot /></main>
```

```svelte +page.svelte
<h1>Page content</h1>
<aside role="complementary">Related links</aside>
<!-- moved out from under +layout.svelte's <main> -->
```

## Mode differences

Landmarks are collected in both modes, but from different sources, so results can differ:

- **Static (CLI)** composes the route's layout chain with its resolved local components to detect nesting. It cannot see nesting introduced by an unresolvable component (`node_modules`, a dynamically chosen component).
- **Rendered (vite)** reads the final prerendered HTML, so it sees nesting produced by any component, resolvable or not. It has no source files to attribute a finding to, so its findings anchor to the route itself rather than a specific file and line — the persisted finding key differs from the static-mode key for the same defect.

When the two disagree, trust the rendered result — it reflects what ships to the browser.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/top-level-landmark': 'off'
  }
};
```
