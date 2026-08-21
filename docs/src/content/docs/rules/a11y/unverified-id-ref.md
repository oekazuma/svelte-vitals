---
title: a11y/unverified-id-ref · Unverified id reference
description: 'Opt-in: flags id references that cannot be verified on routes whose composition is not fully resolved.'
---

**Severity:** info · **Category:** a11y · **Opt-in** (off by default)

## What it checks

On routes [`a11y/no-missing-id-ref`](/rules/a11y/no-missing-id-ref) must skip — any route whose composition is not fully resolved (an unresolved component, a spread attribute, `{@html}`, or a dynamic `id` anywhere in the composed files) — this rule matches every literal id reference against every literal id the analysis did see (all branches, resolved components, and the `src/app.html` shell). A reference that matches nothing is reported as **unverifiable** — deliberately not as _missing_: the id may exist inside exactly the content the analysis could not see. Every finding names the causes that keep the route unresolved, with file and line, so the claim can be checked by hand. The two rules split cleanly: fully resolved routes belong to `a11y/no-missing-id-ref`, everything else to this rule — no route is ever reported by both.

`href="#top"` and text-fragment directives keep the sibling rule's exemptions.

## Why it is opt-in

svelte-vitals defaults to zero false positives: the sibling rule skips rather than guesses, and the JSON report's `skipped` map says where and why. This rule trades that guarantee for reach — an unmatched reference here is a _candidate_ defect, not a proven one — so it never runs unless you enable it:

```js
// svelte-vitals.config.js
export default {
  rules: { 'a11y/unverified-id-ref': 'info' }
};
```

or one-off: `npx svelte-vitals --rules a11y/unverified-id-ref`. An `overrides` entry cannot enable it — overrides apply to results after analysis — but once enabled globally, overrides scope it normally (e.g. `'off'` for a route subtree).

## Mode differences

Source-mode (CLI and the dev dashboard's static layer) only. In rendered mode (`vite build`) the prerendered document is always fully resolved, so this rule can never fire there — `a11y/no-missing-id-ref` covers rendered documents completely, and the plugin prints a notice if this rule is enabled in a build.

## How to fix

Confirm the reference in the rendered page. If the id genuinely never renders, fix it as you would a [`a11y/no-missing-id-ref`](/rules/a11y/no-missing-id-ref) finding; if it lives inside a library component, pass the id through or silence the finding with a suppressions entry.

## Disabling

Being opt-in, not enabling it is the default disable. Once enabled, an inline `svelte-vitals-disable-next-line` comment above the line a finding names silences it — the suppressions file (`npx svelte-vitals --update-suppressions`) is the per-route mechanism for a directive that would otherwise need repeating at every call site of a shared component. You can also scope the rule per route or path with `overrides`, or turn it off again:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/unverified-id-ref': 'off'
  }
};
```
