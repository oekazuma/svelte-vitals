---
title: a11y/placeholder-label-option · Missing placeholder label option
description: A required, single-selection select needs an empty first option so users can't submit it unchanged.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags a `<select required>` — with no `multiple` attribute and a display size absent or `1` — whose first `option` element child is not a placeholder label option. Checked from component source, by both the CLI and the Vite plugin — the plugin reads the same `.svelte` files, so the result is identical in either mode. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

Per the HTML spec, a placeholder label option is the first `option` and must have either:

- An empty `value` attribute: `<option value="">Choose…</option>`.
- No `value` attribute and no text content: `<option></option>`.

Not flagged:

- `multiple`, or a display `size` greater than `1` — the browser doesn't force an initial selection, so there's nothing to placeholder.
- No `required` attribute.
- An expression-valued `required`, `multiple`, or `size` — its runtime value is unknown statically.
- An expression-valued `value` on the first option, or text content containing an `{expression}` — its effective value is unknowable statically.
- The select's first child being an `{#each}` block or a component — what it renders as the first option can't be resolved statically.

```svelte
<select required>
  <option value="">Choose…</option>
  <option value="a">A</option>
</select>
```

## Why it matters

A required `<select>` initially displays its first option as the selected value. If that option is not an empty placeholder, the field already holds a value the user never actively chose — they can submit the form without making a real selection, and a screen reader announces that value as already selected, giving no cue that a choice is still needed.

## How to fix

Make the first `option` an empty placeholder:

```svelte
<select required>
  <option value="">Choose…</option>
  <option value="a">A</option>
</select>
```

Do not mark it `disabled` on its own. The select's reset algorithm selects the first option that is **not** disabled, so a disabled placeholder leaves `A` selected, `required` satisfied, and the user submitting a value they never chose — the exact harm this rule reports. Write `disabled selected` if you want it unselectable, so the placeholder is still what the field starts on.

## Disabling

If the first option is intentionally a real, non-placeholder value, silence a single element with `<!-- svelte-vitals-disable-next-line a11y/placeholder-label-option -->`, or turn the rule off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/placeholder-label-option': 'off'
  }
};
```
