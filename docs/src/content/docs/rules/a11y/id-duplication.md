---
title: a11y/id-duplication · Id duplication
description: Every id in a route should be unique.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags a literal `id` value that occurs more than once across a route's composed layout chain (every `+layout.svelte` up to the route's `+page.svelte`) and its resolved local components. Detection is branch-aware: within an `{#if}`/`{#await}` block only the arm with the most occurrences counts (ties break to the first arm in document order), so the arms of one `{#if}` are not summed. Two _separate_ `{#if}` blocks are independent, though — `{#if a}…{/if}{#if !a}…{/if}` is counted as both rendering, since nothing here evaluates `a`.

Ids are detected cross-file — an `id="search"` in `+layout.svelte` plus another `id="search"` in `+page.svelte` (or in an imported `$lib` component) is one duplicate, even though neither file alone looks wrong. A file-scoped markup linter cannot see this, since the duplication only exists once the layout and the page are composed.

Not flagged:

- A route where every id is unique.
- An `{#each}` body's id, since the loop can render 0..N times and the resulting duplicate count is not knowable statically — rendered analysis catches an actual duplicate (N≥2 renders) at runtime, by design.
- A dynamic id (`id={expr}`), since its runtime value is unknown statically.

## Why it matters

A duplicate id breaks the two things ids exist for: `<label for>`/`aria-labelledby`/`aria-describedby` resolve to the _first_ element with that id, and in-page fragment navigation (`#anchor`) jumps to the _first_ match too. If the author's intent was the second element — a common outcome when a layout and a page both introduce the same id — assistive technology and fragment links silently point at the wrong element, with no visual sign anything is wrong.

## How to fix

Rename one of the colliding ids so it's unique within the route:

```svelte +layout.svelte
<nav id="site-search">...</nav>
```

```svelte +page.svelte
<section id="page-search">...</section>
<!-- was id="site-search", collided with the layout -->
```

## Mode differences

Ids are collected in both modes, but from different sources, so results can differ:

- **Source analysis** (the CLI, the dashboard's static baseline) composes the route's layout chain with its resolved local components, using the branch-aware fold: within an `{#if}`/`{#await}` block only the arm with the most occurrences is credited, so it can pick a branch that would not actually render. It cannot see ids contributed by an unresolvable component (`node_modules`, a dynamically chosen component), and `{#each}` bodies are excluded since their id count is not knowable statically.
- **Source analysis** (the CLI, the dashboard's static baseline) also does not report a page id that collides with one in `src/app.html`: shell ids are read as candidates a reference may point at, not as occurrences to count.
- **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the final prerendered HTML, so it sees only the ids that actually rendered, including a collision with a shell id and every id an `{#each}` loop produced — a real duplicate from a loop only surfaces here. It has no source files to attribute a finding to, so its findings anchor to the route itself rather than a specific file and line — the persisted finding key differs from the static-mode key for the same defect.

When the two disagree, trust the rendered result — it reflects what ships to the browser.

## Disabling

An inline `svelte-vitals-disable-next-line` comment above the line the finding names silences it — source analysis only, since a build-pass finding points at the prerendered HTML and has no source line to sit above. That line often sits in a composed component, and one directive there silences the finding on every route composing it — the suppressions file (`npx svelte-vitals --update-suppressions`) is the per-route mechanism. You can also scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/id-duplication': 'off'
  }
};
```
