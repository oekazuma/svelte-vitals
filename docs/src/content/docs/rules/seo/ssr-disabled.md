---
title: seo/ssr-disabled · SSR disabled
description: export const ssr = false makes a route's content invisible to non-JS crawlers and slower to first paint.
---

**Severity:** warning · **Category:** seo

## What it checks

Flags SvelteKit route files that disable server-side rendering with `export const ssr = false` (the `satisfies`/`as` and same-file alias-export forms included). Disabling it in the root `+layout` — which turns the whole app into an SPA — gets a stronger, app-wide message.

Not flagged: `csr = false` (server-only rendering — fine for SEO), non-literal values like `export const ssr = dev` (not statically evaluable), and non-exported `const ssr = false` (has no effect in SvelteKit).

## Why it matters

SvelteKit's own SEO guidance: server-side rendered content is indexed more frequently and reliably — leave SSR on unless you have a good reason not to. On top of the indexing risk, SPA mode ships an empty page that must fetch and run JavaScript before anything renders, adding a network round trip before first paint.

Note that `prerender = true` does not neutralise this: with `ssr = false` the prerendered output is still an empty shell.

## How to fix

Scope `ssr = false` to routes that genuinely don't need SEO:

```ts src/routes/(app)/dashboard/+page.ts
export const ssr = false; // fine — suppress or turn the rule off if this is deliberate
```

For a deliberate full SPA, disable the rule in your config:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/ssr-disabled': 'off'
  }
};
```

or add `// svelte-vitals-disable-next-line seo/ssr-disabled` above the declaration.

## Mode differences

None. This rule reads source — the same `.svelte` and `.ts` files — on every surface: the CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line seo/ssr-disabled -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/ssr-disabled': 'off'
  }
};
```
