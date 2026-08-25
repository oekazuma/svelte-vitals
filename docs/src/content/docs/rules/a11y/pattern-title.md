---
title: a11y/pattern-title · Pattern input without a format description
description: When an input has a pattern, the spec says authors should include a title describing the expected format — without it a failed submit tells the user only that the value is wrong.
---

**Severity:** info · **Category:** a11y

## What it checks

Flags an `<input>` with a literal `pattern` but no `title` describing the expected format:

```svelte
<input pattern="[A-Za-z]+-[0-9]+" />
```

Only inputs where `pattern` is actually effective are judged: no `type` (the missing type defaults to Text) or a literal `type` in the spec's applies-to set — `text`, `search`, `url`, `tel`, `email`, `password` (matched case-insensitively). A blank literal `title=""` describes nothing and is flagged; an expression-valued `title={expr}` counts as present.

Not flagged:

- A literal `type` outside the applies-to set (`type="number"`) — `pattern` is inert there, so requiring a `title` would be wrong.
- An expression-valued `type` or `pattern` — unknowable statically.
- An input with a spread attribute, or one inside `<svg>` (it never renders as a form control there).

## Why it matters

The spec says that when a `pattern` attribute is specified, authors should include a `title` giving a description of the pattern. Browsers surface that `title` in the validation error, so without it a failed submit tells the user only that the value is wrong — not what right looks like.

## How to fix

Describe the expected format in plain words, and mirror it in visible help text (`title` alone is unavailable to touch and keyboard users and to many assistive-technology users):

```svelte
<input pattern="[A-Za-z]+-[0-9]+" title="Letters, a dash, then digits" />
```

## Limitations

An unknown `type` keyword (`type="txet"`) falls back to the Text state per spec, where `pattern` does apply — but this rule skips types outside the known set rather than guess at typos, a deliberate, conservative false negative.

A regex quantifier brace (`{3}`) is parsed as a Svelte expression inside a template attribute, so a pattern using one is typically written as an expression — `pattern={'[A-Za-z]{3}[0-9]{4}'}` — which this rule skips as unknowable. Patterns written as plain literals (no braces) are fully covered.

## Mode differences

None. This rule reads source — the same `.svelte` and `.ts` files — on every surface: the CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

If the format is explained some other way this rule can't see (visible help text tied via `aria-describedby`), silence the element with `<!-- svelte-vitals-disable-next-line a11y/pattern-title -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/pattern-title': 'off'
  }
};
```
