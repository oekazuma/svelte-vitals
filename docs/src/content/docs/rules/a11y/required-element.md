---
title: a11y/required-element · Required element
description: Every route must contain the elements a project declares, judged on the composed route, so a layout's <main> counts.
---

**Severity:** warning · **Category:** a11y

Declaration-driven: the rule has no opinion of its own. With nothing declared it does nothing; declare the tags every route must carry, such as a `<main>`, an `<h1>` or a `<nav>`, and a route composed without one is a finding wherever the tool can see the whole route (see _Mode differences_).

## What it checks

Each route's **body**, as composed: the layout chain, the page, every component that resolves to a repo-local `.svelte` file, and `app.html`'s `<body>` (source analysis), or the prerendered document's `<body>` (the build pass). An element supplied by a layout or a resolved component counts, which is why this is judged per route and not per file: a `+page.svelte` alone rarely holds the `<main>`.

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/required-element': { options: { elements: ['main', 'h1'] } }
  },
  overrides: [{ route: '/docs/**', rules: { 'a11y/required-element': { options: { elements: ['nav'] } } } }]
};
```

`elements` is a list of **bare tag names** (a letter, then letters, digits and hyphens; case-insensitive); selector syntax is rejected when the config loads. An `overrides` entry with `route` **adds** to the list for the routes it matches.

Presence is optimistic, so an element inside any `{#if}` arm, `{#each}` body or snippet counts, and it is a body rule: `<svelte:head>` content never counts (a required `<title>` is `seo/title-presence`'s job), `<template>` children do not (they are inert until instantiated), and `<svelte:element>` does not, whatever its `this`.

```svelte
<!-- +layout.svelte -->
<nav>…</nav>
<slot />

<!-- +page.svelte, with `main` declared -->
<h1>Title</h1>
<p>No main here or in the layout.</p>
```

**Present** is a safe claim in any world: an unresolved component can only add elements, so a route with every declared element present passes whether or not everything resolved. **Missing** is a claim about the whole page, and it is made only when the world is closed for elements: every component resolved, no `{@html}`, no `<svelte:element>`. A route missing a declared element with the world open emits nothing.

## Mode differences

- **Rendered analysis** (the Vite plugin's build pass): the document is the closed world, so presence and absence are both reported on every prerendered route.
- **Source analysis** (the CLI, the dashboard's static baseline): presence is reported everywhere; absence only on routes closed for elements. On a real app most routes compose at least one component that does not resolve to a repo-local file, a UI library or an icon, so absence is reported on few of them until that is addressed. A spread attribute or an expression-valued `id` does not open the world for this rule; they cannot hide an element.

The finding is located at the route's page file in source analysis and at the prerendered HTML file in the build pass. The dashboard's live layer does not evaluate this rule; the static baseline's result stands.

## Why it matters

"Every page has a `<main>` landmark" and "every page contains an `<h1>`" are the kind of structural guarantees a design system promises and a code review forgets to check. Declaring them makes the guarantee a scored, gated finding on the composed route rather than a convention.

## How to fix

Add the element to the route, usually in the layout the route composes, or narrow the declaration with an `overrides` entry for the routes it does not apply to.

## Disabling

Route-scoped findings can be silenced with the suppressions file (`npx svelte-vitals --update-suppressions`) or scoped with `overrides`; remove the declaration, or turn the rule off. One thing to know about the suppressions file: its key is `id::route::location`, and a route missing several declared elements puts all of them under one key, so an entry recorded for a route silences every missing-element finding on it, including a different element that goes missing later:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/required-element': 'off'
  }
};
```
