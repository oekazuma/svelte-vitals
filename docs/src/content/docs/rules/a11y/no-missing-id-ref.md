---
title: a11y/no-missing-id-ref · No missing id reference
description: An id reference should point to an id that exists somewhere in the composed route.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags a literal `for`, `aria-labelledby`, `aria-describedby`, `aria-controls`, or `aria-activedescendant` attribute, or a same-page `href="#…"`, whose referenced `id` does not exist anywhere in the route's composed layout chain (every `+layout.svelte` up to the route's `+page.svelte`), its resolved local components, or the `src/app.html` shell.

`href="#top"` is exempt — the browser scrolls to the document top for that fragment even when no element has `id="top"`, so it is never a missing reference.

**This rule runs on far fewer routes than the other route-scoped a11y rules.** `duplicate-landmark`, `top-level-landmark`, and `id-duplication` each claim "two of these exist", which stays true no matter what an unresolved component might also contribute — they run on every route, an unresolved component only costs a false negative. This rule claims the opposite — "no element anywhere defines this id" — and an unresolved component could be exactly where that id lives, so it needs a closed world: it runs only on a route whose entire composition is verified fully resolved — every component in the transitive closure actually resolved (no `node_modules`/library import, no dynamically chosen component, no depth truncation), no `{@html}`, no spread attribute, and no dynamic `id` anywhere in any composed file. A route that fails any of these conditions is **skipped entirely** — the rule emits nothing for it, not a false "pass".

In practice, a single library component anywhere in a route's composition — a UI kit's `<Button>`, a `<Link>` from a routing helper, anything under `node_modules` — closes the world nowhere, so the rule never runs on that route. A typical app with such a component in its root layout gets this rule on none of its routes. That is accepted, not a bug: a false positive here would send someone hunting for an id that in fact exists inside a component the analysis couldn't see, so skipping the whole route beats guessing.

## Why it matters

The id and its reference routinely live in different files — a `<label for="email">` in a form component, `id="email"` on an `<input>` several components away, or an anchor link that only makes sense once the actual page is composed. Single-file linters like markuplint cannot check this at all, since the defect only exists once the route is composed across files. Assistive tech resolves `for`/`aria-labelledby`/`aria-describedby`/`aria-controls`/`aria-activedescendant` by id lookup in the final DOM; when the target doesn't exist, the association silently fails — a label reads as unrelated text, an `aria-describedby` announces nothing extra, and a fragment link scrolls nowhere.

## How to fix

Add the missing id to the referenced element, or fix a typo'd reference:

```svelte
<label for="email">Email</label>
<input id="email" type="email" />
```

## Mode differences

Reference checking runs in both modes, but from different sources, so results can differ:

- **Static (CLI)** composes the route's layout chain with its resolved local components and requires the closed-world condition above — any unresolved component, `{@html}`, spread attribute, or dynamic id anywhere in the composition skips the whole route.
- **Rendered (vite)** reads the final prerendered HTML, which already is a closed world by construction — every id and reference that ships to the browser is visible, so this mode has no equivalent skip condition and can check routes static mode cannot. It has no source files to attribute a finding to, so its findings anchor to the route itself rather than a specific file and line — the persisted finding key differs from the static-mode key for the same defect.

When the two disagree, trust the rendered result — it reflects what ships to the browser.
