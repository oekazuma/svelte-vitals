---
title: a11y/duplicate-landmark · Duplicate landmark
description: A route should have at most one main, banner, and contentinfo landmark.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags a route whose composed layout chain (every `+layout.svelte` up to the route's `+page.svelte`) plus resolved local components yields more than one `main`, `banner`, or `contentinfo` landmark. Detection is branch-aware: within an `{#if}`/`{#await}` block only the arm with the most occurrences counts (ties break to the first arm in document order), so the arms of one `{#if}` are not summed — two _separate_ `{#if}` blocks are independent, though, since nothing here evaluates their conditions — and `{#each}`/`{#snippet}` bodies are excluded since they render 0..N times.

Landmarks are detected cross-file — a `<main>` in `+layout.svelte` plus another `<main>` in `+page.svelte` is one route with two `main` landmarks, and so is a layout's `<main>` plus a `<main>` rendered by an imported `$lib` component. `<main>` and an explicit `role="banner"`/`role="contentinfo"` count everywhere a route composes them. `<header>`/`<footer>` (the implicit `banner`/`contentinfo` landmarks) count only at a chain file's template top level — inside a nested component they may sit inside sectioning content in whatever parent uses that component, so counting them there could manufacture a duplicate that doesn't exist.

A route with none of the three landmark kinds emits nothing.

## Why it matters

Assistive technology users jump between landmarks (main, banner, contentinfo) with a keystroke to skip repeated boilerplate and reach page content. More than one of the same kind on a page leaves that jump ambiguous — which one is the actual page content, which is the actual site header?

## How to fix

Keep one `<main>`, one `<header>`/`role="banner"`, and one `<footer>`/`role="contentinfo"` per route. A layout that already renders one of these should not have the page (or an imported component) render another:

```svelte +layout.svelte
<header>Site navigation, shown on every route</header>
<main>{@render children()}</main>
<footer>Site footer, shown on every route</footer>
```

```svelte +page.svelte
<h1>Page content</h1>
<!-- no second <main> here -->
```

## Mode differences

Landmarks are collected in both modes, but from different sources, so results can differ:

- **Static (CLI)** composes the route's layout chain with its resolved local components, using the branch-aware fold: within an `{#if}`/`{#await}` block only the arm with the most occurrences is credited, so it can pick a branch that would not actually render. It cannot see landmarks contributed by an unresolvable component (`node_modules`, a dynamically chosen component), and `{#each}`/`{#snippet}` bodies are excluded from counting since they render 0..N times.
- **Rendered (vite)** reads the final prerendered HTML, so it sees only the branches that actually rendered, and it sees every landmark an `{#each}` loop produced. It has no source files to attribute a finding to, so its findings anchor to the route itself rather than a specific file and line — the persisted finding key differs from the static-mode key for the same defect.

When the two disagree, trust the rendered result — it reflects what ships to the browser.

## Disabling

An inline `svelte-vitals-disable-next-line` comment above the line the finding names silences it. That line often sits in a composed component, and one directive there silences the finding on every route composing it — the suppressions file (`npx svelte-vitals --update-suppressions`) is the per-route mechanism. You can also scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/duplicate-landmark': 'off'
  }
};
```
