---
title: a11y/deprecated-attr · Deprecated HTML attribute
description: An attribute the HTML spec data marks deprecated on this element has its behavior defined by legacy compatibility, not by the standard.
---

**Severity:** info · **Category:** a11y

Scored `info` rather than `warning`: the attribute may still work today. The finding is that the standard no longer defines what it means, and a CSS or modern-attribute replacement exists.

## What it checks

Flags an attribute the HTML spec data marks deprecated (or obsolete) **on that element** — `iframe[frameborder]`, `td[width]`, `body[bgcolor]`, `hr[size]`, `style[type]` — in component source, by both the CLI and the Vite plugin. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

Deprecation is per element: `width` is deprecated on `<td>` and current on `<img>`, so only the first is reported.

Not flagged:

- Any attribute on an element `a11y/deprecated-element` reports (`<font color>`), or on `<marquee>`/`<blink>` — one finding per element. That holds even when `a11y/deprecated-element` is off or suppressed inline: this rule skips obsolete elements by name.
- Anything inside `<svg>`, or in a component declaring `<svelte:options namespace="svg" />`; content under `<foreignObject>` returns to HTML.
- The global attribute groups (`xml:lang`, `xlink:href`, `onwebkit*`) — only an element's own attribute table is consulted, so `<use xlink:href="#icon">` in an SVG sprite is never reported.
- Attributes only marked `nonStandard` or `experimental`. One marked both `deprecated` and `nonStandard` (`hr[size]`) is reported.
- A component's own `<style>` block: it is the component stylesheet, not an element. A `<style type="text/css">` inside `<svelte:head>` is an element and is reported.

```svelte
<iframe src="/embed" frameborder="0" title="Map"></iframe>
<td width="120">…</td>
```

**Coverage follows the dataset**, which is the `deprecated`/`obsolete` columns of the vendored HTML spec data (`@markuplint/html-spec`) and tracks MDN's status rather than the WHATWG obsolete-features list. That cuts both ways: an attribute MDN marks deprecated is reported even where the standard's word differs (`a[attributionsrc]`), and WHATWG-obsolete attributes MDN never documented — `p[align]`, `td[nowrap]`, `html[manifest]` — are not reported.

## Why it matters

A deprecated attribute's behavior is defined by what browsers still do for legacy pages, not by the standard, and each has a replacement — usually CSS, sometimes a modern attribute — whose behavior is defined.

## How to fix

Move the presentation to CSS, or use the attribute the deprecated one was superseded by:

```svelte
<iframe src="/embed" title="Map" style="border: 0"></iframe>
<td style="width: 120px">…</td>
```

## Disabling

Silence a single element with `<!-- svelte-vitals-disable-next-line a11y/deprecated-attr -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/deprecated-attr': 'off'
  }
};
```
