---
title: a11y/deprecated-aria · Deprecated ARIA role or attribute
description: A role or aria-* attribute ARIA 1.3 has deprecated — globally, or on the role it sits on — still works today and is no longer defined there.
---

**Severity:** info · **Category:** a11y

Scored `info` rather than `warning`: the role or attribute still works in current assistive technology. What the finding says is that ARIA 1.3 removed it from the definition, so its meaning there is no longer guaranteed.

## What it checks

Three things, judged against the ARIA 1.3 tables in component source.

- A deprecated role: `role="directory"` (its replacement is `list`).
- A globally deprecated attribute: `aria-dropeffect` and `aria-grabbed`, on any element.
- An attribute deprecated on the resolved role: `aria-haspopup` on `checkbox`, `aria-disabled` on `generic` (a bare `<div>`/`<span>`), and the other combinations ARIA 1.2 and 1.3 removed. The role is resolved as `a11y/disallowed-aria-props` resolves it — an explicit role's first concrete token, or every implicit role the element could have, with a finding only when the attribute is deprecated under all of them.

```svelte
<div role="checkbox" tabindex="0" aria-checked="false" aria-haspopup="true">…</div>

<div aria-grabbed="true">…</div>
```

Not flagged: an attribute `a11y/unknown-aria-attribute` already reports. The per-role arm makes no judgment on a DPUB-ARIA role, an expression role, or a spread with no literal role — the role is unknown there — while the deprecated role and the two global attributes are reported regardless.

**Overlap with the Svelte compiler.** For explicit roles the compiler reports the per-role case as _not supported_ (`a11y_role_supports_aria_props`), at warning — its ARIA data dropped the deprecated attributes rather than flagging them. The verdict is the same; the label and severity differ. On a bare `<div>`/`<span>` — the common real case, `aria-disabled` — the compiler is silent. It is also silent on `role="directory"` and on the two global attributes.

## Why it matters

Deprecation in ARIA is removal from the role's definition. Today's assistive technology mostly still honours the old meaning; the next version need not, and a rewrite that keeps the attribute keeps a dependency on undefined behaviour.

## How to fix

Replace `role="directory"` with `role="list"`; drop `aria-dropeffect`/`aria-grabbed` (drag-and-drop is expressed through the widget's own semantics now); move a role-deprecated attribute to an element whose role still defines it, or drop it:

```svelte
<div role="checkbox" tabindex="0" aria-checked="false">…</div>
```

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

Silence a single element with `<!-- svelte-vitals-disable-next-line a11y/deprecated-aria -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/deprecated-aria': 'off'
  }
};
```
