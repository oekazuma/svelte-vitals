---
title: a11y/abbr-title · Abbreviation without an expansion
description: An <abbr> without a title gives readers no expansion. Visual users get no tooltip and assistive technology has nothing to expand.
---

**Severity:** info · **Category:** a11y

## What it checks

Flags an `<abbr>` with no `title` giving the expansion:

```svelte
<p>The <abbr>W3C</abbr> publishes the spec.</p>
```

A blank literal `title=""` carries no expansion and is also flagged. An expression-valued `title={expr}` passes, since its rendered value is unknowable and the attribute's presence is assumed to carry one.

Not flagged:

- An `<abbr>` with a spread attribute, whose rendered attributes are unknowable.
- An `<abbr>` inside `<svg>`, which is not an SVG element and never renders there.

## Why it matters

`<abbr>` marks an abbreviation, but without a `title` giving the expansion the element adds no information. Visual users get no tooltip and assistive technology has nothing to expand.

This is a best-practice nudge, not a conformance requirement: the spec keeps `title` optional, and giving the expansion in the surrounding prose is also correct markup.

## How to fix

Add the expansion as `title`, or spell the term out in full at first use:

```svelte
<p>The <abbr title="World Wide Web Consortium">W3C</abbr> publishes the spec.</p>
```

## Limitations

An expansion provided in the surrounding text, as in `The World Wide Web Consortium (<abbr>W3C</abbr>)`, is conforming markup this rule cannot see, and is the known false-positive class. Silence those with the inline directive below rather than adding a redundant `title`.

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

If the expansion is given in the surrounding text, silence the element with `<!-- svelte-vitals-disable-next-line a11y/abbr-title -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/abbr-title': 'off'
  }
};
```
