---
title: a11y/use-list · Bullet text should be a list
description: A bullet character typed into plain text should be a real list element instead.
---

**Severity:** info · **Category:** a11y

## What it checks

Flags text that opens with a bullet character (`•`, `・`, `·`, `-`, or `*`) followed by whitespace — **when there are at least two such items under one parent**, as sibling text nodes (`- one<br>- two`) or as the opening text of sibling elements (`<p>• one</p><p>• two</p>`). A lone bullet line is a dash, not a list; WCAG technique H48 is about sequences of items, and one item is not a sequence.

Not flagged:

- The bullet character elsewhere in the text, e.g. `a - b` or `-webkit-...` — only the start of the trimmed text counts.
- A bullet character with no following whitespace, e.g. a signed number like `-1`.
- Text already inside an `<li>`.
- Text that follows an `{expression}` among its siblings — `<p>{count} - results found</p>` trims to `- results found`, which is a sentence tail, not a bullet.
- Text inside `<pre>`, `<code>`, `<kbd>`, `<samp>` or `<textarea>`, where a leading dash is content.

This is a heuristic, not a structural check — it can't tell a genuine bullet from an author's stylistic dash, so it's scored as `info` rather than `warning`.

```svelte
<div>
  <p>• Ships within one business day</p>
  <p>• Backed by a two-year warranty</p>
</div>
```

## Why it matters

A real `<ul>`/`<ol>` gives assistive technology list semantics: item count, position within the list, and where the list starts and ends. A bullet character typed into plain text looks the same visually but carries none of that structure, so a screen reader announces it as ordinary prose.

## How to fix

Use a list element instead:

```svelte
<ul>
  <li>Ships within one business day</li>
  <li>Backed by a two-year warranty</li>
</ul>
```

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

If the bullet character is intentional prose, not a stand-in for a list, silence a single occurrence with `<!-- svelte-vitals-disable-next-line a11y/use-list -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/use-list': 'off'
  }
};
```
