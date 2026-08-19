---
title: a11y/deprecated-element · Obsolete HTML element
description: An element in the HTML standard's obsolete-features list is non-conforming and has a conforming replacement.
---

**Severity:** info · **Category:** a11y

Scored `info` rather than `warning`: the element still renders and browsers keep it working. What is lost is the guarantee — its semantics are unspecified for assistive technology, and each element has a replacement the standard does define.

## What it checks

Flags an element named in the HTML standard's obsolete-features list — `<center>`, `<font>`, `<strike>`, `<big>`, `<tt>`, `<frame>`, `<applet>`, and the rest of that section — in component source, by both the CLI and the Vite plugin. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

Not flagged:

- Anything inside `<svg>`, or in a component declaring `<svelte:options namespace="svg" />`. The check is for HTML elements only; content under `<foreignObject>` returns to HTML and is checked.
- The conforming replacements: `<s>` for `<strike>`, `<span>` plus CSS `font-size` for `<big>` (`<b>`/`<strong>` would change the meaning), `<code>`/`<kbd>`/`<samp>` for `<tt>`.

```svelte
<strike>old price</strike>
<font color="red">styled with markup</font>
```

`<marquee>` and `<blink>` are reported here **and** by the Svelte compiler (`a11y_distracting_elements`). That overlap is deliberate: the compiler streams into the build log and does not score, gate, or suppress, and a score that counted `<font>` but not `<marquee>` would be blind to two obsolete elements. The two never disagree — both say the element must go.

An obsolete element yields one finding. Its deprecated attributes (`<font color>`) are not reported a second time by `a11y/deprecated-attr` — and that stays true when this rule is turned off or suppressed inline: the attribute rule skips obsolete elements by name, not by looking at this rule's result.

The element list is the `obsolete` column of the vendored HTML spec data (`@markuplint/html-spec`), which matches the WHATWG obsolete-features section exactly.

## Why it matters

Obsolete elements are non-conforming: browsers keep rendering them so that legacy pages do not break, but the standard defines no meaning for them, so what assistive technology announces — and what a future browser renders — is not something the page can rely on. Each has a replacement whose semantics are defined.

## How to fix

Replace the element with its conforming equivalent and move presentation to CSS:

```svelte
<s>old price</s>
<span class="alert">styled with CSS</span>
```

## Disabling

Silence a single element with `<!-- svelte-vitals-disable-next-line a11y/deprecated-element -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/deprecated-element': 'off'
  }
};
```
