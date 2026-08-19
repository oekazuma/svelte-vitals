---
title: 'security/javascript-url · javascript: URL'
description: 'Avoid javascript: URLs in attributes.'
---

**Severity:** warning · **Category:** security

## What it checks

Flags an element attribute (`href` / `src` / `action` / `formaction`) whose literal value starts with `javascript:`. Dynamic values are not checked.

## Why it matters

A `javascript:` URL breaks under a strict Content-Security-Policy and turns what should be a real navigation into inline script execution on activation — use an event handler on a `<button>` instead. (The same shape is also a classic XSS vector, though detection here is literal-only, so every flagged URL is author-written, not injected.)

## How to fix

Use an event handler or a real URL:

```svelte
<!-- Instead of <a href="javascript:doThing()"> -->
<button type="button" onclick={doThing}>Do thing</button>
```

## Mode differences

None. This rule reads source — the same `.svelte` and `.ts` files — on every surface: the CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line security/javascript-url -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'security/javascript-url': 'off'
  }
};
```
