---
title: performance/iframe-loading · Iframe loading attribute
description: An offscreen iframe loads an entire third-party document eagerly — scripts, fonts, media — usually costing more than an offscreen image; loading="lazy" defers it.
---

**Severity:** info · **Category:** performance

Scored `info`, like `performance/image-loading-hint`: an above-the-fold iframe is legitimately eager, and static analysis cannot tell where the iframe sits on load — so this is advisory.

## What it checks

Flags an `<iframe>` element with no `loading` attribute:

```svelte
<iframe src="https://www.youtube.com/embed/…" title="Video"></iframe>
```

Not flagged:

- A literal `loading` attribute of any value — `loading="lazy"` or `loading="eager"` — the author made a choice.
- An expression-valued `loading={expr}` — the rendered value is unknowable statically.
- A spread attribute — it could supply `loading`.

## Why it matters

An iframe without a `loading` attribute loads eagerly, and an offscreen iframe (an embedded video player, a map, an ad slot) typically loads an entire third-party document — scripts, fonts, media — so the bandwidth and main-thread cost of eagerly loading one is usually larger than for an image. `loading="lazy"` on `<iframe>` has been supported in all evergreen browsers for years and defers the load until the viewport approaches.

Unlike images, iframes rarely are the LCP element, so lazy-loading one almost never trades away a Core Web Vital.

## How to fix

If the iframe can be offscreen on load, add `loading="lazy"`:

```svelte
<iframe src="https://www.youtube.com/embed/…" title="Video" loading="lazy"></iframe>
```

Keep an above-the-fold iframe eager — an explicit `loading="eager"` documents the choice and silences the rule.

## Limitations

Only native `<iframe>` elements in component source are covered. A dynamic tag via `<svelte:element this="iframe">`, an iframe injected through `{@html}`, and an iframe living in `src/app.html` are out of static reach and are not flagged.

A deliberately invisible iframe — `hidden`, zero-sized, a silent-renew auth frame, a tracking beacon — is still flagged, and `loading="lazy"` is the wrong fix there: it can defer the request the frame exists to fire. Mark those with an explicit `loading="eager"`, or suppress the line.

## Mode differences

None. This rule reads source — the same `.svelte` and `.ts` files — on every surface: the CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

For an iframe that is always above the fold, prefer an explicit `loading="eager"` over a suppression. Otherwise silence a single element with `<!-- svelte-vitals-disable-next-line performance/iframe-loading -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/iframe-loading': 'off'
  }
};
```
