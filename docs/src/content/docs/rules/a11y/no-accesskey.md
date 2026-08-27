---
title: a11y/no-accesskey · Accesskey attribute
description: The accesskey attribute assigns a page-level shortcut key whose actual combination varies by browser and OS, is undiscoverable, and conflicts with assistive-technology bindings.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags any element carrying an `accesskey` attribute:

```svelte
<button accesskey="s">Save draft</button>
```

Unlike most attribute rules, an expression-valued `accesskey={key}` is also flagged: the attribute's presence is the problem, and its value never matters, so there is nothing unknowable about it.

Not flagged:

- An `accesskey` supplied through a spread attribute, which is out of static reach.

## Why it matters

`accesskey` assigns a page-level keyboard shortcut, but the actual key combination is chosen by the browser and OS, not by you. The same markup means Alt+key in one browser, Alt+Shift+key in another, and Ctrl+Opt+key on macOS. Users have no way to discover that the shortcut exists, and the combinations routinely collide with screen reader and browser keyboard bindings, silently stealing commands from the users who depend on them most. Long-standing accessibility guidance is to not use the attribute at all.

## How to fix

Remove the attribute and rely on visible, focusable controls:

```svelte
<button>Save draft</button>
```

If a real keyboard shortcut is needed, implement it with a key handler and document it visibly in the page. That way you choose the exact combination and can avoid reserved ones.

## Limitations

Only attributes on statically named elements are covered, custom elements included. A spread attribute that supplies `accesskey` and a dynamic tag via `<svelte:element>` are out of static reach and are not flagged.

## Overlap with the Svelte compiler

The compiler warns on the same markup as `a11y_accesskey`. That overlap is deliberate: the compiler streams into the build log and does not score, gate, or suppress, while this rule feeds the health score, respects `svelte-vitals-disable-next-line`, and fails CI through `--fail-on`. Both checks judge the attribute's presence regardless of its value, so there are no known divergences.

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

If an `accesskey` is genuinely intended, silence a single element with `<!-- svelte-vitals-disable-next-line a11y/no-accesskey -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/no-accesskey': 'off'
  }
};
```
