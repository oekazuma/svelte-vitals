---
title: architecture/route-component-import · Route component import
description: A SvelteKit route entry is rendered by the framework, not imported by other components.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags an import, from another component, of a SvelteKit route entry: `+page.svelte`, `+layout.svelte`,
`+error.svelte`, and the `@` breakout forms of `+page`/`+layout`.

## Why it matters

A route entry is written on the assumption that SvelteKit renders it. Kit hands a page its `data` and
`params`, and an error page its `page.error` and `page.status`. Imported from somewhere else, the
component receives none of that and renders against nothing, or against the importing page's data
standing in for its own.

The mistake is easy to make and reads as reasonable: another page needs the same markup, the markup
already exists in a `+page.svelte`, so it gets imported. Nothing else objects, and the component renders,
emptily.

## How to fix

Extract the shared markup into a component under `$lib` and import that from both places, leaving the
route entry to SvelteKit.

## Configuration

| Option            | Type          | Default                                                           |
| ----------------- | ------------- | ----------------------------------------------------------------- |
| `exemptImporters` | `string-list` | `['**/*.stories.svelte', '**/*.test.svelte', '**/*.spec.svelte']` |

Files matching `exemptImporters` may import a route entry: a story renders it to look at, a test renders
it to assert on, and both supply by hand what SvelteKit would have supplied.

**The default is deliberately narrow, and configuring it is an expected step rather than an exceptional
one.** A `string-list` option adds to its default and never replaces it, so you can extend this list but
not shrink it, which is why it ships covering only the conventions that are common across the ecosystem.
If your project marks satellite files another way, add your pattern:

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/route-component-import': {
      options: { exemptImporters: ['**/*.fixture.svelte'] }
    }
  }
};
```

## Not reported

- A dynamic `import()` of a route entry: it is not an import declaration, so the analyzer does not see it.
- An import made from a plain `.ts` or `.js` file: import facts are collected from `.svelte` component
  files and `.svelte.ts` / `.svelte.js` modules only.
- A type-only import (`import type P from './+page.svelte'`, or one whose every specifier is inline-typed).
  It is erased at build, so nothing renders.
- A project whose routes live somewhere other than `src/routes`.

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line architecture/route-component-import -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/route-component-import': 'off'
  }
};
```
