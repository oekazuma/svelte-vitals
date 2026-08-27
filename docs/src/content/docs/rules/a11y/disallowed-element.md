---
title: a11y/disallowed-element · Disallowed element
description: Reports every occurrence of the elements a project declares it does not want — nothing until something is declared.
---

**Severity:** warning · **Category:** a11y

Declaration-driven: the rule has no opinion of its own. With nothing declared it does nothing; declare the tags your project does not want and every occurrence is a finding.

## What it checks

Every element in component source whose tag name is in the declared list.

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/disallowed-element': { options: { elements: ['iframe', 'marquee'] } }
  }
};
```

`elements` is a list of **bare tag names** — a letter, then letters, digits and hyphens, so custom-element names (`my-widget`) are fine — matched case-insensitively. Anything else (`input[type=file]`, `.legacy`, `div > p`) is rejected when the config loads: the value would otherwise be accepted and silently match nothing, and giving it meaning later would change what an accepted config means. Where a declaration applies is `overrides`' job, as for every rule: an entry with `files` or `route` **adds** to the list for the files it matches (a `string-list` option extends, never replaces).

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/disallowed-element': { options: { elements: ['iframe'] } }
  },
  overrides: [
    { files: 'src/routes/(marketing)/**', rules: { 'a11y/disallowed-element': { options: { elements: ['video'] } } } }
  ]
};
```

Findings sit at the element's start tag, so one `<!-- svelte-vitals-disable-next-line a11y/disallowed-element -->` above the tag silences it however many lines the tag spans. A component with elements and none disallowed passes.

Not seen: `<svelte:element this="iframe">` — the tag is dynamic to the collector even with a literal `this`.

## Why it matters

Some elements have no place in a given project's markup — `<iframe>` in content pages, a legacy custom element mid-migration, `<font>` anywhere — and a review comment does not scale. Declaring them here makes the rule the reviewer, scored and gated like every other finding.

## How to fix

Replace the element with the one the project prefers, or narrow the declaration with an `overrides` entry for the files where it is allowed.

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

Silence a single element with `<!-- svelte-vitals-disable-next-line a11y/disallowed-element -->`, remove the declaration, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/disallowed-element': 'off'
  }
};
```
